# Import statements
import os
import json
import csv
import time
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from urllib.parse import quote
from shapely import wkt
import folium
import geopandas as gpd
from datetime import datetime
import random
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from openai import OpenAI
import re
import concurrent.futures
from flask import Flask, request, jsonify
import pandas as pd
import branca.colormap as cm

# Load environment variable from .env file for OpenAI and initialize OpenAI API
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError('The OPENAI_API_KEY environment variable is missing or empty')
openai = OpenAI(api_key=api_key)

# Names of open ai models to use
embeddingModel = "text-embedding-3-large"
model = "gpt-4o"

# Titles of all datasets, used to translate titles into indices used in file names
titles = [
    "Crosswalk Between 2010 and 0 US Census Tracts",
    "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender",
    "Household Income and Incarceration for Children from Low-Income Households by County, Race, and Gender",
    "Household Income and Incarceration for Children from Low-Income Households by Commuting Zone, Race, and Gender",
    "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile",
    "All Outcomes by County, Race, Gender and Parental Income Percentile",
    "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile",
    "All Outcomes at the National Level by Race, Gender and Parental Income Percentile",
    "Crosswalk Between Income/Wage Percentiles and 2015 Dollars",
    "Neighborhood Characteristics by Census Tract",
    "Neighborhood Characteristics by County",
    "Neighborhood Characteristics by Commuting Zone",
    "in5Not4"
]

# Lists of different options for different variables. For example, you might have kfr for black male or kfr for white male p100
percentiles = ["p1", "p10", "p25", "p50", "p75", "p100"]
genders = ["male", "female", "pooled"]
races = ["white", "black", "hisp", "asian", "natam", "other", "pooled"]

# Configures Flask app, disabling CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Takes in two lists and returns the cosine similarity between them
# Used for comparing embeddings
def similarity(vector1, vector2):
    # Some embeddings are set to 0 so they are not used
    # This skips those all 0 embeddings
    if np.all(vector1 == 0) or np.all(vector2 == 0):
        return 0
   
    vector1 = np.array(vector1)
    vector2 = np.array(vector2)
    dot_product = np.dot(vector1, vector2)
    norm_vector1 = np.linalg.norm(vector1)
    norm_vector2 = np.linalg.norm(vector2)
    epsilon = 1e-8  # Small value to prevent division by zero
    cosine_similarity = dot_product / (max(norm_vector1 * norm_vector2, epsilon))
    return cosine_similarity


# Takes in two lists, one of dictionaries, one of int values, and returns those lists sorted by the values in the first list
def sort_distances_with_headers(distances, headers):
    combined = sorted(zip(distances, headers), key=lambda x: x[0], reverse=True)
    sorted_distances, sorted_headers = zip(*combined)
    return list(sorted_distances), list(sorted_headers)

# Delays for a given number of milliseconds
# Used to prevent exceeding the OpenAI API rate limit for embeddings
def delay(ms):
    time.sleep(ms / 1000)

# Takes in a list of strings and returns the embeddings for those strings
# Makes requests to the API in parallel to speed up the process
# Waits for 60 seconds after every 2900 requests to prevent exceeding the rate limit
def get_embedding_throttled(raw_array):
    embedding_results = []
    requests_per_batch = 2900
    delay_between_batches = 60

    def create_embedding(row):
        return openai.embeddings.create(model=embeddingModel, input=row, encoding_format="float")

    for i in range(0, len(raw_array), requests_per_batch):
        batch = raw_array[i:i + requests_per_batch]
        print(f"Processing batch {i // requests_per_batch + 1} with {len(batch)} requests...")

        with concurrent.futures.ThreadPoolExecutor() as executor:
            batch_results = list(executor.map(create_embedding, batch))
        
        embedding_results.extend(batch_results)
        
        if i + requests_per_batch < len(raw_array):
            print(f"Waiting for {delay_between_batches} seconds before processing the next batch...")
            time.sleep(delay_between_batches)

    print('All embeddings completed.')
    return embedding_results

# Takes in a csv file path and returns the header row of the csv file
def get_header_row(file_path):
    with open(file_path, 'r') as file:
        reader = csv.reader(file)
        header_row = next(reader)
    return header_row

# Takes in a json file path and returns the descriptions from the json file
# Used to read the files in the description_units folder
def get_descriptions(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data['variables']

# Takes in headers, which is a list of variable names and descriptions, which is a list of dictionaries with both variables names and their corresponding descriptions
# The headers contains variable names from the sheets, which have thing like white and male in them
# The descriptions contains variable names from the json files, instead have things in them like [race] and [gender] in them
# Returns a dictionary with the variable names from the sheets as keys and their corresponding descriptions from the json files as values
# The descriptions are the first description that matches the format of the variable name from the sheets
def match_headers_with_descriptions(headers, descriptions):
    header_descriptions = {}
    for header in headers:
        matched_description = 'Description not found'
        for desc in descriptions:
            desc_parts = desc['name'].split('_')
            header_parts = header.split('_')
            if len(desc_parts) != len(header_parts):
                continue
            match = True
            for desc_part, header_part in zip(desc_parts, header_parts):
                # For a certain part of the variable name, checks if there is text in bracets like [race]
                # If there is, ignores that specific braceted text in the comparision
                if '[' in desc_part and ']' in desc_part:
                    desc_prefix = desc_part.split('[')[0]
                    desc_suffix = desc_part.split(']')[-1]
                    if not (header_part.startswith(desc_prefix) and header_part.endswith(desc_suffix)):
                        match = False
                        break
                # If their is no bracted text, checks for an exact match
                elif desc_part != header_part:
                    match = False
                    break
            if match:
                matched_description = desc['description']
                break
        header_descriptions[header] = matched_description
        if (matched_description == 'Description not found'):
            print(f"Description not found for header: {header}")
            raise Exception("No match")
    return header_descriptions

# Takes in lists of variable names and descriptions in a dictionary and returns a list of strings with the variable names and descriptions combined
def merge_headers_with_descriptions(headers, descriptions):
    return [f"VARIABLE NAME: {header} - VARIABLE DESCRIPTION: {descriptions[header]}" for header in headers]

# Takes in a list of embeddings as returned from the OpenAI API and returns a list of the embeddings without any special data structure
def prep_embedding_list(embedding):
    return [emb.data[0].embedding for emb in embedding]

# Takes in an embedding and a file path and a list of embeddings and saves them to the file as json under the key 'embedding'
# If the embeddings are still in the form they are returned from the OpenAI API, they are converted to a list without any special data structure before being saved
def save_embedding(embedding, file_path):
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)
    with open(file_path, 'w') as file:
        try:
            json.dump({'embedding': prep_embedding_list(embedding)}, file)
        except:
            json.dump(embedding, file)

# Reads a json file, converts it to an object, and returns the object
def read_json_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

# Reads a csv file, splits it by new lines, and returns the data as a list of strings where each string is a row
def read_csv_file(file_path):
    with open(file_path, 'r') as file:
        data = file.read().split('\n')
    return data

# Takes in a folder path and returns a list of the names of the files in that folder
def get_files_in_folder(folder_path):
    return os.listdir(folder_path)

# Takes in the name of a sheet in the headers folder (with the .csv ending) and a list of variable names that need to be fetched from that sheet
# Specifically, the last name in the list is the variable name that matter and the rest are just location specifications, like state, state_name, etc.
# Returns a list of lists where each list contains the values of the variables in the sheet for the given variable names (includes header row)
def get_relevant_columns(index, columns):
    # Initialize an empty list to store the column arrays
    col_arrays = []
    
    # Iterate over each column in the columns list
    for column in columns:
        file_path = f"./data_columns/{index}_{column}.csv"
        
        if os.path.exists(file_path):
            lines = read_csv_file(file_path)
            column_data = [line.split(',')[0].strip() for line in lines[0:]]  # Skip header and fetch the first (and only) column
            col_arrays.append(column_data)
            
            print(f"Loaded column {column} from {file_path}")
        else:
            print(f"File {file_path} does not exist.")
    
    for i in range(len(col_arrays)):
        for j in range(len(col_arrays[i])):
            if col_arrays[i][j] == '""':
                col_arrays[i][j] = '';

    return col_arrays
    
# Ensures that each string in a given list or a standalone string ends with a punctuation mark (., !, or ?)
# If it does not adds a period to fix that
def ensure_ending(value):
        if isinstance(value, list):
            return [item if isinstance(item, str) and item.endswith(('.', '!', '?')) else f"{item}." if isinstance(item, str) else item for item in value]
        elif isinstance(value, str):
            return value if value.endswith(('.', '!', '?')) else f"{value}."
        return value

# Takes in a query from the user consisting of key words separated by spaces
# Returns a list of strings where each string represents a variable. The strings with the lower indexes are more likely to match the search
def handle_chat_request_no_sheets(user_message):
    # Gets a list of all the information that was embedded in the same order that it appears in the embeddings files
    # The files are ordered by numerical value
    all_merged_headers_and_description = []
    for num in (1, 4, 9, 12):
        all_merged_headers_and_description.extend(get_stripped_names_and_descriptions(num)["merged_headers_descriptions"])

    # Calculates the embedding of the user's messages
    embedding = get_embedding_throttled([user_message])
    
    # Gets the names of all the avalable embeddings files and sorts them to be in acceding numerical order
    names = [int(name[:-5]) for name in get_files_in_folder("embedding")]
    names.sort()

    # Loads the embeddings from the files
    embeddings = [read_json_file(f"embeddings/{name}.json") for name in names]

    # Calculates the cosine similarity between the user's message and all the embeddings, then flattens the resulting list
    distances = [[similarity(embedding[0].data[0].embedding, emb[j]) for j in range(len(emb))] for emb in embeddings]
    all_distances = [dist for sublist in distances for dist in sublist]

    # Parse user_message by spaces
    user_words = user_message.split()

    # Calculates another distance metric, also scaled 0 to 1, based on the proportion of words in the user's message that are found in text that was embedded
    dumb_distance = []
    for text in all_merged_headers_and_description:
        text_words = text.split()
        match_count = sum(1 for word in user_words if any(text_word.find(word) != -1 for text_word in text_words))
        proportion = match_count / len(user_words)
        dumb_distance.append(proportion)

    # Combines the two distance metrics, weighting them differently
    all_distances = [(0.8 * old + 0.2 * dumb) for old, dumb in zip(all_distances, dumb_distance)]

    rawForIndex = {}
    processedForIndex = {}
    allHeaders = []
    sheetNames = []

    # List of things that are removed from headers before they are embedded
    toRemove = ["p1", "p10", "p25", "p50", "p75", "p100", "n", "mean", "se", "s", "imp", "white", "black", "hisp", "asian", "natam", "other", "pooled", "male", "female", "2010", "2000", "2016", "1990", "24", "26", "29", "32"]

    # Fills in the following lists
    # rawForIndex: A dictionary where the keys are the names of the sheets and the values are the headers of the sheets
    # processedForIndex: A dictionary where the keys are the names of the sheets and the values are the headers of the sheets with the unwanted words removed (they are rejoined to still be strings)
    # sheetNames: A list of the names of the sheets that the headers are from. The names are repeated for each header in the sheet that is unique once the unwanted words are removed
    # allHeaders: A list of lists. Each sublist contains the unique headers of a sheet with the unwanted words removed
    for name in names:
        headers = get_header_row(f'./headers/{name}.csv')
        rawForIndex[name] = headers

        headers = [re.split(r'[_\s]', header) for header in headers]
        cleaned_headers = []

        for header in headers:
            cleaned_header = [word for word in header if word not in toRemove]
            cleaned_headers.append(cleaned_header)
        
        headers = ['_'.join(header) for header in cleaned_headers]
        processedForIndex[name] = headers
        headers = list(dict.fromkeys(headers))
        sheetNames.extend([name for _ in range(len(headers))])
        allHeaders.append(headers)

    # Flattens the unique headers list
    all_headers = [header for sublist in allHeaders for header in sublist]

    # Formulates a list of dictionaries, one dictionary for each unique header with words removed
    # Each dictionary has the sheet name from which that variable come from and a list of indexes of the headers in that sheet that correspond to it
    allCols = []
    for indx, header in enumerate(all_headers):
        sheetName = sheetNames[indx]
        indexes = [i for i, x in enumerate(processedForIndex[sheetName]) if x == header]
        allCols.append({'indexes': indexes, 'sheetName': sheetName})

    # Sorts allCols by the distances so that the headers with the greatest distances are first
    # The first element in sorted_headers is a list of distances, the second is a list of dictionaries
    sorted_headers = sort_distances_with_headers(all_distances, allCols)
    allColsSorted = sorted_headers[1]

    # If the greatest distance is less than 0.1, returns to the front end that no suitable variable was found
    if sorted_headers[0][0] < 0.1:
        return {"headers": ["NO"], "distances": all_distances}

    # Makes a dictionary where the keys are the names of the sheets and the values are lists of variable descriptions
    new_headers_dict = {name: read_json_file(f"header_description/{name}.json")['embedding'] for name in names}
    # Makes sure that all of the descriptions end with a punctuation mark, adding a period if they do not
    new_headers_dict = {k: ensure_ending(v) for k, v in new_headers_dict.items()}

    # Brings everything together to create a list of strings, where the strings with the lower indexes represent variables that are close to the user's query
    # Each string contains the title of the sheet, the name of the variable, and the description of the variable
    headers_and_descriptions = []
    for i in range(len(allColsSorted)):
        sheetName = allColsSorted[i]['sheetName']
        indexes = allColsSorted[i]['indexes']
        for index in indexes:
            # Does not use any variable that end with _se or _n
            if (not rawForIndex[sheetName][index].endswith("_se") and not rawForIndex[sheetName][index].endswith("_n")):
                headers_and_descriptions.append(f"{titles[sheetName]}LINK{rawForIndex[sheetName][index]}SPECIAL{new_headers_dict[sheetName][index]}")

    return {"headers": headers_and_descriptions, "distances": all_distances}

# Sends a list of message dictionaries to the OpenAI API and returns the response
def ask_GPT(prompt):
    return chat_completion_request(prompt).content

# Sends a list of message dictionaries to the OpenAI API along with a function dictionary and any information on specific functions that must be called
# Returns the response
def function_GPT(prompt, function, requiredFunction=None):
    tools = [{"type": "function", "function": function}]
    if not requiredFunction:
        chat_response = chat_completion_request(
            prompt, tools=tools
        )
    else:
        chat_response = chat_completion_request(
            prompt, tools=tools, tool_choice={"type": "function", "function": {"name": requiredFunction}}
        )
    print(chat_response)
    return chat_response

# Takes in the name of a variable and the string title of a sheet that that variable is from
# Returns a list of lists representing a table with that variable on the far right and the label columns for that variable on the far left
# Also padding the table to give it uniform dimensions
# Label columns generally refer to locations. Examples of label columns include state id, state name, county id, county name, etc.
def get_table_data(sheet, variable):
    index = titles.index(sheet)
    label_cols = read_json_file(f"label_col_names/{index}.json")['labelCols']
    label_cols.append(variable)
    cols = get_relevant_columns(index, label_cols)
    max_len = max(len(col) for col in cols)
    cols = [col + [''] * (max_len - len(col)) for col in cols]
    rows = np.array(cols).T.tolist()
    return rows

# Takes in a string title of a sheet and returns a string containing what each row in that sheet represents
def get_units(sheet):
    index = titles.index(sheet)
    return read_json_file(f"description_units/{index}.json")['units']

# Takes in a string representing a variable name and removes any placeholders from it along with any suffixes at the end like mean, n, se, etc.
def simplify_name(name):
    # Remove placeholders except [year]
    simplified = re.sub(r'\[race\]|\[gender\]|\[age\]', '', name)
    simplified = re.sub(r'p\[pctile\]', 'p', simplified)  # Replace p[pctile] with just p
    simplified = re.sub(r'_(n|mean|se|s|imp|mean_se)$', '', simplified)  # Remove suffixes at the end
    # Remove any resulting double underscores and trim
    return re.sub(r'_{2,}', '_', simplified).strip('_')

# Takes in header, a list of strings representing a variable name, and desc_name, a string representing a variable name
# First extracts the year from the header if present and replaces [year] in desc_name with the actual year if found in the header
# Then calculates the match score between the header and desc_name, the fraction of words in the header that are also in desc_name
def match_score(header, desc_name):
    # Extract year from header if present
    header_year = re.search(r'\d{4}', ''.join(header))
    header_without_year = [part for part in header if not part.isdigit()]
    
    # Replace [year] in desc_name with actual year if found in header
    if header_year:
        desc_name = desc_name.replace('[year]', header_year.group())
    
    desc_parts = set(desc_name.split('_'))
    header_parts = set(header_without_year)
    
    return len(header_parts.intersection(desc_parts)) / len(header_parts)

# Takes in the integer name of a sheet
# Returns a list of strings where each string contains the variable name, description, and unit
# All variables are unique after having things like p1, white, and mean removed from them
def get_stripped_names_and_descriptions(sheetName):
    # Gets the values in the header row of the sheet
    headers = get_header_row(f'./headers/{sheetName}.csv')
    toRemove = ["p1", "p10", "p25", "p50", "p75", "p100", "n", "mean", "se", "s", "imp", "white", "black", "hisp", "asian", "natam", "other", "pooled", "male", "female", "2010", "2000", "2016", "1990", "24", "26", "29", "32"]
    # Split headers and remove unwanted words
    processed_headers = []
    for header in headers:
        split_header = re.split(r'[_\s]', header)
        filtered_header = [word for word in split_header if word not in toRemove]
        processed_headers.append(filtered_header)
    # Remove duplicates while preserving order
    unique_headers = []
    seen = set()
    for header in processed_headers:
        header_tuple = tuple(header)  # Convert list to tuple for hashing
        if header_tuple not in seen:
            seen.add(header_tuple)
            unique_headers.append(header)
    headers = unique_headers
    # Gets the descriptions that belong to the variables in the sheet
    descriptions = get_descriptions(f'./description_units/{sheetName}.json')
    # Matches the headers with the description with a variable name that most closely matches the header
    matched_headers = []
    for header in headers:
        best_match = {"header": header, "description": "", "score": 0}
    
        for desc in descriptions:
            desc_name = simplify_name(desc["name"])
            score = match_score(header, desc_name)
        
            if score > best_match["score"]:
                best_match = {"header": header, "description": desc["description"], "score": score}
    
        if best_match["score"] > 0:
            matched_headers.append(best_match)
        else:
            matched_headers.append({"header": header, "description": ""})
    # Check if any headers didn't get a match
    unmatched = [h for h in matched_headers if h["description"] == ""]
    if unmatched:
        print("Warning: Some headers did not get a match.")
        print("Unmatched headers:", [h["header"] for h in unmatched])
    for header in matched_headers:
        header["header"] = '_'.join(header["header"])
    # Creates a list of strings where each string contains the variable name and the description of the variable
    merged_headers_descriptions = [f"VARIABLE NAME: {matched_headers[i]["header"]} - VARIABLE DESCRIPTION: {matched_headers[i]["description"]}" for i in range(len(headers))]
    # Gets the units of the variables in the sheet and adds them to the strings
    unit = read_json_file(f"description_units/{sheetName}.json")['units']
    merged_headers_descriptions = [f"{desc} - UNIT: {unit}" for desc in merged_headers_descriptions]

    return {"merged_headers_descriptions": merged_headers_descriptions, "matched_headers": matched_headers}

# Takes in a string and unescapes any escape sequences in it
def unescape_string(s):
    if (s == None):
        return None
    # Define a function to replace escape sequences
    def replace_escape_sequences(match):
        return bytes(match.group(0), "utf-8").decode("unicode_escape")
    
    # Find all escape sequences and replace them
    return re.sub(r'\\[ntr"\'\\]', replace_escape_sequences, s)

# Takes in a string and removes the word county from it, whether it is capitalized or not
def remove_county_from_string(input_str):
    return input_str.replace('county', '').replace('County', '').strip()

# Takes in a list of lists and a county name and returns a list of the county codes that match the county name
def find_county_codes(data, county_name):
        matching_counties = []
        for row in data:
            if len(row) >= 2 and remove_county_from_string(row[1].strip().lower()) == county_name:
                matching_counties.append(row[0])
        return matching_counties

# Takes in a list of lists and a state name and returns the state id that matches the state name
def find_state_id(data, state_name):
        for row in data:
            if len(row) >= 2 and row[1].strip().lower() == state_name:
                return row[0]
        return None

# Takes in data and produces a choropleth map of the data
def create_folium_choropleth(gdf, data_column, state_center, zoom):
    # Convert the 'geometry' column to shapely geometries
    gdf['geometry'] = gdf['geometry'].apply(wkt.loads)

    # Convert DataFrame to GeoDataFrame
    gdf = gpd.GeoDataFrame(gdf, geometry='geometry')

    # Ensure all geometries are present
    gdf = gdf[gdf['geometry'].notnull()]

    # Convert GeoDataFrame to GeoJSON
    geo_json_data = gdf.to_json()

    # Create the map centered on the state
    m = folium.Map(location=state_center, zoom_start=zoom, scrollWheelZoom=False)

    # Clip the data values to avoid outliers skewing the color map
    lower_bound = np.percentile(gdf[data_column].dropna(), 5)
    upper_bound = np.percentile(gdf[data_column].dropna(), 95)
    gdf[data_column] = np.clip(gdf[data_column], lower_bound, upper_bound)

    # Create a linear color map with white in the middle
    min_value = gdf[data_column].min()
    max_value = gdf[data_column].max()
    # linear = cm.LinearColormap(['#872c9b', '#ffffff', '#de7356', '#7e1727', '#ffffc8', '#2b5371'], vmin=min_value, vmax=max_value)
    linear = cm.LinearColormap(['#7e1727', '#ffffc8', '#2b5371'], vmin=min_value, vmax=max_value)
    
    # Add the choropleth layer
    def style_function(feature):
        value = feature['properties'].get(data_column)
        if value is None:
            return {
                'fillColor': 'gray',  # Default color for missing values
                'color': 'black',
                'weight': 0.2,  # Thinner line
                'fillOpacity': 0.7,
                'lineOpacity': 1,
            }
        else:
            return {
                'fillColor': linear(value),
                'color': 'black',
                'weight': 0.2,  # Thinner line
                'fillOpacity': 0.7,
                'lineOpacity': 1,
            }
    
    # Create the map
    folium.GeoJson(
        geo_json_data,
        style_function=style_function
    ).add_to(m)
    
    # Add the color map to the map
    m.add_child(linear)

    return m

# Takes in a path to a shapefile and returns data from the file
def get_shapefile_columns(filepath):
    gdf = gpd.read_file(filepath)
    return gdf.columns

# Takes message, any functions, the names of any functions that must be used, and the model to use
# Returns the response from the OpenAI API
def chat_completion_request(messages, tools=None, tool_choice=None, model=model):
    try:
        response = openai.chat.completions.create(
             model=model,
             messages=messages,
             tools=tools,
             tool_choice=tool_choice,
             temperature=0,
        )
        response_text = response.choices[0].message
        return response_text
    except Exception as e:
        print("Unable to generate ChatCompletion response")
        print(f"Exception: {e}")
        return e

# Handles a data request from the front end by calling handle_chat_request_no_sheets
@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    response = handle_chat_request_no_sheets(user_message)
    return jsonify({'reply': response['headers'], 'distances': response['distances']})

# Describes some data by asking chatGPT and returns the response
@app.route('/chatData', methods=['POST'])
def chat_data():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will explain in language any non expert can understand what data has just been presented. I will ask if you want me to query the database again. I will not make up any other variables that were not already mentioned earlier. I will not use numerical examples from any data I am given or reference specific locations in the data. IMPORTANTLY, if the data is not what the user was asking for I will say so. IMPORTANT: If the data is for a specific percentile, I will mention this. Data is for a specific percentile if the variable name ends with _pSOMENUMBER, for example, if the name ends with p50 it is for a specific percentile. I will begin my explanation with \"This data\"\n"})
    response = ask_GPT(messages)
    return jsonify({'reply': response})

# Fetches a specified datable and its corresponding units and returns them
@app.route('/getData', methods=['POST'])
def get_data():
    sheet = request.json['sheet']
    variable = request.json['variable']
    table_data = get_table_data(sheet, variable)
    units = get_units(sheet)
    return jsonify({'tableData': table_data, 'units': units})

# Takes in the messages and calls a function with chatGPT, either setting up a database query or answering the user's question directly
@app.route('/des', methods=['POST'])
def des():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "If you do not specify a race, gender, or percentile I will do my best to make a function request with what I know. If no location is given I will not fill in the location arguments. I will not say that I am searching for data and just need a \"moment\" if I do not call the function. (Don't tell the user this, but I do not know what variables are in the database) When I call a function, I will always use all the \"required\" parameters."})
    function = {"name": "get_data",
                "description": "Query the database for data",
                "parameters": {"type": "object",
                               "properties": 
                               {"query": {"type": "string", "description": "Key words or phrases that should be put into the database's vector search features. These should not include any reference to location, race, percentile, or gender. If the user wants the same variable that they got before, use the full description of that variable from above."},
                                "location type": {"type": "string", "enum":["address", "commuting zone", "county", "other", "counties in state", "census tracts in state", "state", "all US counties"], "description": "The type of location the user has provided if they provided one. The double location names, like counties in state are for when the user asks for something in something else. For example, they could ask for census tracts in Florida or counties in New York. Do not be afraid to say other or not include this parameter if they do not mention a location."},
                                "location name": {"type": "string", "description": "The name of the location, if one is provided, that should be used. If it is abbreviated, write it out fully. For example, NY would be New York."},
                                "race": {"type": "string", "enum":["white", "black", "natam", "asian", "other", "pooled"], "description": "The race the data should be found for. Use pooled if not race is given."},
                                "gender": {"type": "string", "enum":["male", "female", "pooled"], "description": "The gender the data should be found for. Use pooled if no gender is given."},
                                "percentile": {"type": "string", "enum":["p1", "p10", "p25", "p50", "p75", "p100"], "description": "The percentile the data should be found for. Use p50 if no percentile is given."},
                                }},
                "required": ["query", "race", "gender", "percentile"]
                }
    response = function_GPT(messages, function)
    print(response)
    if response.content != None:
        return jsonify({'reply': response.content})
    else:
        return jsonify({'reply': response.tool_calls[0].function.arguments})
    
# Takes in the messages and picks a variable to display with a chatGPT function call
# Also describes the data
@app.route('/pickVarAndDescribe', methods=['POST'])
def pick_var_and_describe():
    messages = request.json['messages']
    function = {"name": "pick_var_and_describe",
                "description": "The chatbot has just queried the database and has received a list of variables. This function continues the conversation with the user by specifying which of the received variables best helps the user. In most cases you should provide a variable. You can only pick variables that are preceded by \"VARIABLE NAME:\" and you must pick a variable that you are given. You may not make up a variable under any circumstances.",
                "parameters": {"type": "object",
                               "properties": 
                               {"found": {"type": "boolean", "enum":["true", "false"], "description": "Whether the chatbot found a variable that helps the user. Ignore location information."},
                                "name": {"type": "string", "description": "The name of the variable which will help the user. Left blank if non of the variables help the user. The variable used here must be found earlier in the chat and must be found preceded by VARIABLE NAME:"},
                                "response": {"type": "string", "description": "The response to the user which includes a description of the chosen variable. Include the full name of the variable in the description. The description will be clear so anyone can understand it. I will use formatting, including new lines, and emojis in a tasteful way. I will not use formatting that has already been used in the conversation. Left blank if non of the variables help the user. IMPORTANTLY, if the data is not what the user asked for I will say so. At the end of the response ask the user what they want next. I will start the response with \"This data\""},
                                }},
                "required": ["variable"]
                }
    response = function_GPT(messages, function, "pick_var_and_describe")
    return jsonify({'reply': response.tool_calls[0].function.arguments})

# Takes in one message and uses a chatGPT function call to decide what action the chat should take
@app.route('/useCase', methods=['POST'])
def use_case():
    messages = request.json['message']
    messages.append({"role": "assistant", "content": "When it is unclear I will always pick the \"answer question or get data\" option. I will not make a map, calculate a statistic, or make a graph unless the user uses very specific language. I will not make a map unless they use the word \"map\"."})
    function = {"name": "pick_use_case",
                "description": "Decides what the chat should do.",
                "parameters": {"type": "object",
                               "properties": 
                               {"action": {"type": "string", "enum":["create scatter plot", "create map", "calculate mean", "calculate median", "calculate standard deviation", "calculate correlation" "answer question or get data"], "description": "Decides if the user has asked for a graph to be created or not. This is only create graph if the user explicitly asks for a graph. The \"answer question or fetch data\" is often the user asking for data. Do not confuse asked for data with asking for a graph or plot or asking for a variable to be calculated. Also, sees if the user wants various statistics to be calculated about data. If the user does not explicitly ask for one of the other ones, always say \"answer question or fetch data\". Do not choose map if the user does not explicitly use the word \"map\"."},
                                }},
                "required": ["action"]
                }
    response = function_GPT(messages, function, "pick_use_case")
    return jsonify({'reply': response.tool_calls[0].function.arguments})

# Takes in the messages and decides with a chatGPT function call what single variable used be used to calculate a statistic
# If no variable that would work is found explains why
@app.route('/pickSingleStatVar', methods=['POST'])
def pick_single_stat_var():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I have one to calculate a statistic with. If I can I will put the variable name into variable. If not I tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\" I will not mention \"PROVIDED VARIABLES\" to the user."})
    function = {"name": "pick_stat_vars",
                "description": "Calculates a statistic if there is a variable to work with provided under \"PROVIDED VARIABLES\". Otherwise, this function does not run.",
                "parameters": {"type": "object",
                               "properties": 
                               {"variable": {"type": "string", "description": "The variable that should be used to calculate the statistic."},
                                "variableType": {"type": "string", "description": "The type of the variable that should used in the calculation. Make sure to include the whole type, as it is listed in \"PROVIDED VARIABLES\""},
                              }},
                "required": ["variable", "variableType"]
                }
    response = function_GPT(messages, function)
    if (response.content != None):
        return jsonify({'reply': response.content})
    return jsonify({'reply': response.tool_calls[0].function.arguments})

# Takes in the messages and decides with a chatGPT function call what two variables used be used to calculate a statistic
# If no two variables that would work are found explains why
@app.route('/pickDoubleStatVars', methods=['POST'])
def pick_double_stat_vars():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I have two of the same type to use to calculate a statistic with. If I can I will put the variable names into the variable1 and variable2. If not I tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\" I will not mention \"PROVIDED VARIABLES\" to the user."})
    function = {"name": "pick_stat_vars",
                "description": "Calculates a statistic if there are two variables to work with provided under \"PROVIDED VARIABLES\" of the same type. Otherwise, this function does not run.",
                "parameters": {"type": "object",
                               "properties": 
                               {"variable1": {"type": "string", "description": "The first variable that should be used to calculate the statistic."},
                                "variableType1": {"type": "string", "description": "The type of the first variable that should used in the calculation. Make sure to include the whole type, as it is listed in \"PROVIDED VARIABLES\""},
                                "variable2": {"type": "string", "description": "The second variable that should be used to calculate the statistic."},
                                "variableType2": {"type": "string", "description": "The type of the second variable that should used in the calculation. Make sure to include the whole type, as it is listed in \"PROVIDED VARIABLES\""},
                              }},
                "required": ["variable1", "variable2", "variableType1", "variableType2"]
                }
    response = function_GPT(messages, function)
    if (response.content != None):
        return jsonify({'reply': response.content})
    return jsonify({'reply': response.tool_calls[0].function.arguments})

# Takes in the messages and decides with a chatGPT function call what two variables used be used to make a scatter plot
# If no two variables that would work are found explains why
@app.route('/pickGraphVars', methods=['POST'])
def pick_graph_vars():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I have enough variables of the same type to make a graph. If I can I will put the x and y variable names into x and y. If not I tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\" I will not mention \"PROVIDED VARIABLES\" to the user."})
    function = {"name": "pick_graph_vars",
                "description": "Makes a graph if there are enough variables of the same type to do so provided under \"PROVIDED VARIABLES\". Otherwise, this function does not run.",
                "parameters": {"type": "object",
                               "properties": 
                               {"x": {"type": "string", "description": "The variable that should be on the x-axis."},
                                "xType": {"type": "string", "description": "The type of the variable that should be on the x-axis."},
                                "y": {"type": "string", "description": "The variable that should be on the y-axis."},
                                "yType": {"type": "string", "description": "The type of the variable that should be on the y-axis."},
                                }},
                "required": ["x", "xType", "y", "yType"]
                }
    response = function_GPT(messages, function)
    if (response.content != None):
        return jsonify({'reply': response.content})
    return jsonify({'reply': response.tool_calls[0].function.arguments})

# Takes in the messages and decides with a chatGPT function call what single variable used be used to make a map
# If no variable that would work is found explains why
@app.route('/pickMapVars', methods=['POST'])
def pick_map_vars():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I a variable to map. If we have not pulled the right variable from the database yet I will tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\" I will not mention \"PROVIDED VARIABLES\" to the user."})
    function = {"name": "pick_map_vars",
                "description": "Makes a map if there is a variable to map provided under \"PROVIDED VARIABLES\". Otherwise, this function does not run. This function can only graph data for counties in a state.",
                "parameters": {"type": "object",
                               "properties": 
                               {"variable": {"type": "string", "description": "The variable that should be mapped."},
                                "variableType": {"type": "string", "description": "The type of the variable that should be mapped. Make sure to include the whole type, as it is listed in \"PROVIDED VARIABLES\""},
                              }},
                "required": ["variable", "variableType"]
                }
    response = function_GPT(messages, function)
    if (response.content != None):
        return jsonify({'reply': response.content})
    return jsonify({'reply': response.tool_calls[0].function.arguments})

# Takes in an address and returns geocode information related to the census tract that address is in
# Uses the Census Geocoding API
@app.route('/geocode', methods=['POST'])
def geocode():
    address = request.json['address']
    url = f"https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address={quote(address)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json"
    response = requests.get(url)
    return jsonify(response.json())

# Takes in a county name and returns its associated county code
@app.route('/get_county_code', methods=['GET'])
def get_county_code():
    # Remove the word county from the county name
    county_name = remove_county_from_string(request.args.get('county', '').strip().lower())

    # Gets csv data on county codes and names
    file_path = 'countycode-countyname.csv'
    data = read_csv_file(file_path)
    data = [line.split(',') for line in data if line]
    
    # Gets the county codes
    county_codes = find_county_codes(data, county_name)
    
    if county_codes:
        return jsonify({'county_codes': county_codes})
    else:
        return jsonify({'error': 'County not found'}), 404
    
# Takes in a state name and returns the state id
@app.route('/get_state_id', methods=['GET'])
def get_state_id():
    state_name = request.args.get('state', '').strip().lower()

    # Gets data linking state names to state ids
    file_path = 'states.csv'
    data = read_csv_file(file_path)
    data = [line.split(',') for line in data if line]

    # Gets the state id
    state_id = find_state_id(data, state_name)

    if state_id:
        return jsonify({'state_id': state_id})
    else:
        return jsonify({'error': 'State not found'}), 404

# Saves an error report to FireBase
@app.route('/save_report', methods=['POST'])
def save_report():
    report = request.json['data']

    # Initialize Firebase
    cred = credentials.Certificate('atlas-chat-gcloud-key.json')
    try:
        firebase_admin.initialize_app(cred)
    except ValueError:
        pass
    db = firestore.client()

    # Constructs a name for the report using a random digit and the current data time
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    now += str(random.randint(1000000000, 9999999999))

    # Save report to FireBase
    doc_ref = db.collection('reports').document(now)
    doc_ref.set({"data": report})

    return jsonify({'status': 'Report saved successfully'})

# Takes in data from the front end and returns an html choropleth map page
@app.route('/generate_map', methods=['POST'])
def generate_map():
    # Gets the data from the response
    data = request.json.get('table', [])
    geo_level = request.json.get('geo_level', 'county')

    # Create a DataFrame from the data
    df = pd.DataFrame(data)

    # Check if multiple states are present
    states = df.iloc[:, 0].unique()

    # Gets the state FIPS codes
    if len(states) > 1:
        state_fips_list = df.iloc[:, 1].apply(lambda x: str(x).zfill(2)).unique().tolist()
    else:
        state_fips = str(df.iloc[0, 1]).zfill(2)
        state_fips_list = [state_fips]

    # Gets the county FIPS codes
    county_fips = df.iloc[:, 3].apply(lambda x: str(x).zfill(3)).tolist()

    # Gets the tract FIPS codes
    if geo_level == 'tract':
        tract_fips = df.iloc[:, 4].apply(lambda x: str(x).zfill(6)).tolist()

    # Find the shapefile path based on the geographic level
    shapefile_path = None
    if geo_level == 'county':
        shapefile_path = 'map_data/cb_2018_us_county_500k.shp'
    elif geo_level == 'tract':
        shapefile_path = 'map_data/' + state_fips_list[0] + '.shp'

    # Gets the data from the shapfile
    columns = get_shapefile_columns(shapefile_path)

    # Check if the required columns are present in the shapefile
    if 'STATEFP' not in columns or 'COUNTYFP' not in columns:
        print("error")
        return jsonify({"error": "The required columns STATEFP or COUNTYFP are not in the shapefile"}), 400
    if geo_level == 'tract' and 'TRACTCE' not in columns:
        print("error")
        return jsonify({"error": "The required column TRACTCE is not in the shapefile"}), 400

    # Load the shapefile into a GeoDataFrame
    geo_df = gpd.read_file(shapefile_path)

    # Add a GEOID column to the GeoDataFrame
    if geo_level == 'county':
        geo_df['GEOID'] = geo_df['STATEFP'] + geo_df['COUNTYFP']
        geo_df = geo_df[geo_df['STATEFP'].isin(state_fips_list)]
        df['GEOID'] = [state_fips + county for state_fips, county in zip(df.iloc[:, 1].apply(lambda x: str(x).zfill(2)).tolist(), county_fips)]
    elif geo_level == 'tract':
        geo_df['GEOID'] = geo_df['STATEFP'] + geo_df['COUNTYFP'] + geo_df['TRACTCE']
        geo_df = geo_df[geo_df['STATEFP'].isin(state_fips_list)]
        df['GEOID'] = [state_fips + county + tract for state_fips, county, tract in zip(df.iloc[:, 1].apply(lambda x: str(x).zfill(2)).tolist(), county_fips, tract_fips)]


    # Merge the data with the GeoDataFrame
    merged = geo_df.set_index('GEOID').join(df.set_index('GEOID'))
    merged.reset_index(inplace=True)

    # Save the merged data to a CSV file and then reads it back out
    merged.to_csv('merged_data.csv')
    merged = pd.read_csv('merged_data.csv')

    # Calculate the centroid for each geometry
    projected_crs = 'EPSG:3857'

    # Re-project the GeoDataFrame to the projected CRS
    geo_df_projected = geo_df.to_crs(projected_crs)

    # Calculate centroids on the projected GeoDataFrame
    centroids = geo_df_projected.geometry.centroid

    # If needed, you can re-project centroids back to the original CRS
    centroids = centroids.to_crs(geo_df.crs)
    xt = 0
    yt = 0
    for cen in centroids:
        xt += cen.x
        yt += cen.y
    state_center = [yt / len(centroids), xt / len(centroids)]

    # Prepares final data and creates the map
    data_column = merged.columns[-1]
    m = ""
    if len(states) > 1:
        m = create_folium_choropleth(merged, data_column, state_center, 3.5)
    else:
        m = create_folium_choropleth(merged, data_column, state_center, 5.5)

    # Save the map to an HTML string
    map_html = m._repr_html_()

    return jsonify({"html": map_html})

# Loads the index page
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(port=3000)

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
import anthropic

import ollama
from langchain_experimental.llms.ollama_functions import OllamaFunctions

import re
import concurrent.futures

from flask import Flask, request, jsonify
import pandas as pd

from groq import Groq

from typing import List, Optional

# Load environment variables from .env file
load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
groq_api_key = os.getenv('GROQ_API_KEY')

if not api_key:
    raise ValueError('The OPENAI_API_KEY environment variable is missing or empty')

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

percentiles = ["p1", "p10", "p25", "p50", "p75", "p100"]
genders = ["male", "female", "pooled"]
races = ["white", "black", "hisp", "asian", "natam", "other", "pooled"]

openai = OpenAI(api_key=api_key)
groq = Groq()
embeddingModel = "text-embedding-3-large"
model = "gpt-4o"
model_groq = 'llama3-groq-70b-8192-tool-use-preview'
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def similarity(vector1, vector2):
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

def sort_distances_with_headers(distances, headers):
    combined = sorted(zip(distances, headers), key=lambda x: x[0], reverse=True)
    sorted_distances, sorted_headers = zip(*combined)
    return list(sorted_distances), list(sorted_headers)

def delay(ms):
    time.sleep(ms / 1000)

def get_embedding_throttled(raw_array):
    print(raw_array)
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

def get_header_row(file_path):
    with open(file_path, 'r') as file:
        reader = csv.reader(file)
        header_row = next(reader)
    return header_row

def get_descriptions(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data['variables']

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
                if '[' in desc_part and ']' in desc_part:
                    desc_prefix = desc_part.split('[')[0]
                    desc_suffix = desc_part.split(']')[-1]
                    if not (header_part.startswith(desc_prefix) and header_part.endswith(desc_suffix)):
                        match = False
                        break
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

def merge_headers_with_descriptions(headers, descriptions):
    return [f"VARIABLE NAME: {header} - VARIABLE DESCRIPTION: {descriptions[header]}" for header in headers]

def prep_embedding_list(embedding):
    return [emb.data[0].embedding for emb in embedding]

def save_embedding(embedding, file_path):
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)
    with open(file_path, 'w') as file:
        try:
            json.dump({'embedding': prep_embedding_list(embedding)}, file)
        except:
            json.dump(embedding, file)

def save_embedding_other(embedding, file_path):
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)
    with open(file_path, 'w') as file:
        json.dump({'embedding': embedding}, file)

def read_json_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def read_csv_file(file_path):
    with open(file_path, 'r') as file:
        data = file.read().split('\n')
    return data

def get_files_in_folder(folder_path):
    return os.listdir(folder_path)

# def get_relevant_columns(index, columns):
#     print("start")
#     file_path = f"./sheets/{index}.csv"
#     lines = read_csv_file(file_path)
#     headers = lines[0].split(',')
#     cols_index = [headers.index(col) for col in columns if col in headers]
#     col_arrays = [[line.split(',')[col_index] for line in lines if len(line.split(',')) > col_index] for col_index in cols_index]
#     print(columns)
#     return col_arrays

def get_relevant_columns(index, columns):
    # Determine the file path using the last element in columns
    column = columns[-1]
    file_path = f"./newSheets/{index}_{column}.csv"
    
    if os.path.exists(file_path):
        lines = read_csv_file(file_path)
        headers = lines[0].split(',')
        cols_index = [headers.index(col) for col in columns if col in headers]
        col_arrays = [[line.split(',')[col_index].strip() for line in lines[0:] if len(line.split(',')) > col_index] for col_index in cols_index]
        
        print(f"Loaded columns {columns} from {file_path}")
        return col_arrays
    else:
        print(f"File {file_path} does not exist.")
        return []

def handle_chat_request_no_sheets(user_message):
    all_merged_headers_and_description = []
    for num in (1, 4, 9, 12):
      headers = get_header_row(f'./sheets/{num}.csv')
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
      #descriptions = get_descriptions(f'./json-des/{num}.json')
      descriptions = get_descriptions(f'./json-des/{num}.json')
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
      merged_headers_descriptions = [f"VARIABLE NAME: {matched_headers[i]["header"]} - VARIABLE DESCRIPTION: {matched_headers[i]["description"]}" for i in range(len(headers))]
      #unit = read_json_file(f"json-des/{num}.json")['units']
      unit = read_json_file(f"json-des/{num}.json")['units']
      merged_headers_descriptions = [f"{desc} - UNIT: {unit}" for desc in merged_headers_descriptions]
      all_merged_headers_and_description.extend(merged_headers_descriptions)

#good code below here
    embedding = get_embedding_throttled([user_message])
    names = [int(name[:-5]) for name in get_files_in_folder("embedding")]
    names.sort()
    embeddings = [read_json_file(f"embedding/{name}.json") for name in names]
    distances = [[similarity(embedding[0].data[0].embedding, emb[j]) for j in range(len(emb))] for emb in embeddings]
    all_distances = [dist for sublist in distances for dist in sublist]

    # Parse user_message by spaces
    user_words = user_message.split()

    # Calculate dumb_distance for each string in all_merged_headers_and_descriptions
    dumb_distance = []

    for text in all_merged_headers_and_description:
        text_words = text.split()
        match_count = sum(1 for word in user_words if any(text_word.find(word) != -1 for text_word in text_words))
        proportion = match_count / len(user_words)
        dumb_distance.append(proportion)

    all_distances = [(0.5 * old + 0.5 * dumb) for old, dumb in zip(all_distances, dumb_distance)]

    rawForIndex = {}
    processedForIndex = {}
    allHeaders = []
    sheetNames = []
    
    toRemove = ["p1", "p10", "p25", "p50", "p75", "p100", "n", "mean", "se", "s", "imp", "white", "black", "hisp", "asian", "natam", "other", "pooled", "male", "female", "2010", "2000", "2016", "1990", "24", "26", "29", "32"]

    for name in names:
        headers = get_header_row(f'./sheets/{name}.csv')
        print(headers)
        rawForIndex[name] = headers

        headers = [re.split(r'[_\s]', header) for header in headers]
        cleaned_headers = []

        for header in headers:
            cleaned_header = [word for word in header if word not in toRemove]
            cleaned_headers.append(cleaned_header)

            if "jail" in cleaned_header:
                original_header = '_'.join(header)
                print(f"jail found in: {original_header}")

        print("NAME")
        print(name)
        print(cleaned_headers)
        
        headers = ['_'.join(header) for header in cleaned_headers]
        processedForIndex[name] = headers
        headers = list(dict.fromkeys(headers))
        sheetNames.extend([name for _ in range(len(headers))])
        allHeaders.append(headers)

    all_headers = [header for sublist in allHeaders for header in sublist]
    print("ALL_HEADERS")
    print(all_headers)

    allCols = []
    for indx, header in enumerate(all_headers):
        sheetName = sheetNames[indx]
        indexes = [i for i, x in enumerate(processedForIndex[sheetName]) if x == header]
        allCols.append({'indexes': indexes, 'sheetName': sheetName})

    for i in range(len(all_distances)):
        print(all_merged_headers_and_description[i])
        print(all_distances[i])
        print("\n")

    sorted_headers = sort_distances_with_headers(all_distances, allCols)

    if sorted_headers[0][0] < 0.1:
        return {"headers": ["NO"], "distances": all_distances}

    allColsSorted = sorted_headers[1]
    new_headers_dict = {name: read_json_file(f"simplifiedDescriptions/{name}.json")['simplified_descriptions'] if os.path.exists(f"simplifiedDescriptions/{name}.json") else read_json_file(f"newHeader/{name}.json")['embedding'] for name in names}

    def ensure_ending(value):
        if isinstance(value, list):
            return [item if isinstance(item, str) and item.endswith(('.', '!', '?')) else f"{item}." if isinstance(item, str) else item for item in value]
        elif isinstance(value, str):
            return value if value.endswith(('.', '!', '?')) else f"{value}."
        return value

    new_headers_dict = {k: ensure_ending(v) for k, v in new_headers_dict.items()}

    headers_and_descriptions = []
    for i in range(len(allColsSorted)):
        sheetName = allColsSorted[i]['sheetName']
        indexes = allColsSorted[i]['indexes']
        for index in indexes:
            if (not rawForIndex[sheetName][index].endswith("_se") and not rawForIndex[sheetName][index].endswith("_n")):
                headers_and_descriptions.append(f"{titles[sheetName]}LINK{rawForIndex[sheetName][index]}SPECIAL{new_headers_dict[sheetName][index]}")
                if (rawForIndex[sheetName][index].startswith("has_mom")):
                    print(rawForIndex[sheetName][index])


    return {"headers": headers_and_descriptions, "distances": all_distances}

def combine_consecutive_messages(messages):
    if not messages:
        return []

    combined = []
    current_role = messages[0]['role']
    current_content = messages[0]['content']

    for message in messages[1:]:
        if message['role'] == current_role:
            current_content += '\n\n' + message['content']
        else:
            combined.append({'role': current_role, 'content': current_content})
            current_role = message['role']
            current_content = message['content']

    combined.append({'role': current_role, 'content': current_content})

    return combined

def ask_GPT(prompt):
    # completion = openai.chat.completions.create(
    #     model=model,
    #     messages=prompt
    # )
    # return completion.choices[0].message.content
    return chat_completion_request(prompt).content
    

def ask_ollama(prompt):
    response = ollama.chat(model="llama3", messages=prompt)
    return response['message']['content']

# def ask_ollamaf(prompt):
#     response = ollama.chat(model="llama3-groq-tool-use", messages=prompt)
#     return response

# def function_ollama(prompt, function, requiredFunction=None):
#     prompt.append({"role": "assistant", "content": "To respond to the users message, you have access to the following function:\n"})
#     prompt.append({"role": "assistant", "content": json.dumps(function) + "\n"})
#     if (requiredFunction):
#         prompt.append({"role": "assistant", "content": "You must call the function named: " + json.dumps(requiredFunction) + "\n"})

#     print(prompt)
#     print(ask_ollamaf(prompt))

def function_langchain(prompt, function, temperature, requiredFunction=None):
    llm = OllamaFunctions(model="llama3-groq-tool-use", format="json", temperature=temperature)
    llm_with_tools = llm.bind_tools([function])
    tools = [{"type": "function", "function": function}]
    if requiredFunction:
        tool_choice = {"type": "function", "function": {"name": requiredFunction}}
    else:
        tool_choice = None
    
    try:
        response = llm_with_tools.invoke(prompt, tools=tools, tool_choice=tool_choice)
        return response
    except Exception as e:
        print("Unable to generate ChatCompletion response")
        print(f"Exception: {e}")
        return str(e)

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

# def chat_completion_request(messages, tools=None, tool_choice=None, model=model):
#     try:
#         response = openai.chat.completions.create(
#             model=model,
#             messages=messages,
#             tools=tools,
#             tool_choice=tool_choice,
#         )
#         return response
#     except Exception as e:
#         print("Unable to generate ChatCompletion response")
#         print(f"Exception: {e}")
#         return e

def ask_Anthropic(prompt):
    # add a message to the front of the prompt array
    prompt.insert(0, {"role": "user", "content": "Hello!"})
    prompt = combine_consecutive_messages(prompt)
    message = anthropic.Anthropic(api_key="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").messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=1024,
        messages=prompt
    )
    return message.content[0].text

def get_table_data(sheet, variable):
    index = titles.index(sheet)
    label_cols = read_json_file(f"label-col-des/{index}.json")['labelCols']
    label_cols.append(variable)
    cols = get_relevant_columns(index, label_cols)
    max_len = max(len(col) for col in cols)
    cols = [col + [''] * (max_len - len(col)) for col in cols]
    rows = np.array(cols).T.tolist()
    return rows

def get_units(sheet):
    index = titles.index(sheet)
    return read_json_file(f"json-des/{index}.json")['units']

def simplify_name(name):
    # Remove placeholders except [year]
    simplified = re.sub(r'\[race\]|\[gender\]|\[age\]', '', name)
    simplified = re.sub(r'p\[pctile\]', 'p', simplified)  # Replace p[pctile] with just p
    simplified = re.sub(r'_(n|mean|se|s|imp|mean_se)$', '', simplified)  # Remove suffixes at the end
    # Remove any resulting double underscores and trim
    return re.sub(r'_{2,}', '_', simplified).strip('_')

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

@app.route('/headers/<num>', methods=['GET'])
def get_headers(num):
     num = int(num)
     headers = get_header_row(f'./sheets/{num}.csv')
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
     #descriptions = get_descriptions(f'./json-des/{num}.json')
     descriptions = get_descriptions(f'./json-des/{num}.json')
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
     merged_headers_descriptions = [f"VARIABLE NAME: {matched_headers[i]["header"]} - VARIABLE DESCRIPTION: {matched_headers[i]["description"]}" for i in range(len(headers))]
     #unit = read_json_file(f"json-des/{num}.json")['units']
     unit = read_json_file(f"json-des/{num}.json")['units']
     merged_headers_descriptions = [f"{desc} - UNIT: {unit}" for desc in merged_headers_descriptions]
     embeddings = prep_embedding_list(get_embedding_throttled(merged_headers_descriptions))
     # open the corresponding label-col-des file
     #label_cols = len(read_json_file(f"label-col-des/{num}.json")['labelCols'])
     label_cols = read_json_file(f"label-col-des/{num}.json")['labelCols']
     for i in range(len(embeddings)):
          print("\n")
          print(matched_headers[i]["header"])
          print(label_cols)
          if (matched_headers[i]["header"] in label_cols):
                print("zeros")
                for j in range(len(embeddings[i])):
                    embeddings[i][j] = 0
     save_embedding(embeddings, f'embedding/{num}.json')
     return jsonify({'mergedHeadersDescriptions': merged_headers_descriptions, 'embeddings': embeddings})

# @app.route('/makeDes/<num>', methods=['GET'])
# def make_des(num):
#      num = int(num)
#      nums = [num]
#      for num in nums:
#          headers = get_header_row(f'./sheets/{num}.csv')
#          #descriptions = get_descriptions(f'./json-des/{num}.json')
#          descriptions = get_descriptions(f'./json-des/{num}.json')
#          header_descriptions = match_headers_with_descriptions(headers, descriptions)
#          merged_headers_descriptions = merge_headers_with_descriptions(headers, header_descriptions)
#          save_embedding_other(merged_headers_descriptions, f'newHeader/{num}.json')
#      return jsonify({'processed': "All done!"})

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    response = handle_chat_request_no_sheets(user_message)
    return jsonify({'reply': response['headers'], 'distances': response['distances']})

def unescape_string(s):
    if (s == None):
        return None
    # Define a function to replace escape sequences
    def replace_escape_sequences(match):
        return bytes(match.group(0), "utf-8").decode("unicode_escape")
    
    # Find all escape sequences and replace them
    return re.sub(r'\\[ntr"\'\\]', replace_escape_sequences, s)

@app.route('/chatData', methods=['POST'])
def chat_data():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will explain in language any non expert can understand what data has just been presented. I will ask if you want me to query the database again. I will not make up any other variables that were not already mentioned earlier. I will not use numerical examples from any data I am given or reference specific locations in the data. IMPORTANTLY, if the data is not what the user was asking for I will say so. IMPORTANT: If the data is for a specific percentile, I will mention this. Data is for a specific percentile if the variable name ends with _pSOMENUMBER, for example, if the name ends with p50 it is for a specific percentile. I will begin my explanation with \"This data\"\n"})
    response = ask_GPT(messages)
    return jsonify({'reply': response})

@app.route('/getData', methods=['POST'])
def get_data():
    sheet = request.json['sheet']
    variable = request.json['variable']
    print(sheet)
    print(variable)
    table_data = get_table_data(sheet, variable)
    units = get_units(sheet)
    return jsonify({'tableData': table_data, 'units': units})

@app.route('/des', methods=['POST'])
def des():
    messages = request.json['messages']
    # messages.append({"role": "assistant", "content": "If no database request is needed to answer I respond. Otherwise, I respond with DATABASEQUESTION: PROMPT and I do not include anything else in the response including the word data or any extraneous symbols. I will only include key words and phrases for the search. I can only look for one type of data at a time. PROMPT will be replaced with the prompt. I do not have any knowledge outside of what I lean with the database. I will remove any reference to race, gender, or percentile. So, for example, if you say \"asian income\" I would say \"income\". If you want data from a specific location but only mentioned the location earlier, I will add the location. If the location is an address, I will to include the full address. The current dataset provided is just a subset of the database, you can search again with the same terms if needed to get more data."})
    messages.append({"role": "assistant", "content": "If you do not specify a race, gender, or percentile I will do my best to make a function request with what I know. If no location is given I will not fill in the location arguments. I will not say that I am searching for data and just need a \"moment\" if I do not call the function. (Don't tell the user this, but I do not know what variables are in the database)"})
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
    #function_ollama(messages, function)
    #response = function_langchain(messages, function)
    #if response.content != '':
    if response.content != None:
        return jsonify({'reply': response.content})
    else:
        #return jsonify({'reply': response.tool_calls[0].args})
        return jsonify({'reply': response.tool_calls[0].function.arguments})
    

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
    print("RESPONSE")
    print(messages)
    print(response)
    print(response.tool_calls[0].function.arguments)
    return jsonify({'reply': response.tool_calls[0].function.arguments})

@app.route('/useCase', methods=['POST'])
def use_case():
    messages = request.json['message']
    function = {"name": "pick_use_case",
                "description": "Decides what the chat should do.",
                "parameters": {"type": "object",
                               "properties": 
                               {"action": {"type": "string", "enum":["create graph", "create map", "calculate mean", "calculate median", "calculate standard deviation", "calculate correlation" "answer question or fetch data"], "description": "Decides if the user has asked for a graph to be created or not. This is only create graph if the user explicitly asks for a graph. The \"answer question or fetch data\" is often the user asking for data. Do not confuse asked for data with asking for a graph or plot or asking for a variable to be calculated. Also, sees if the user wants various statistics to be calculated about data. If the user does not explicitly ask for one of the other ones, always say \"answer question or fetch data\". Do not choose map if the user does not explicitly use the word \"map\"."},
                                }},
                "required": ["action"]
                }
    response = function_GPT(messages, function, "pick_use_case")
    return jsonify({'reply': response.tool_calls[0].function.arguments})

@app.route('/pickSingleStatVar', methods=['POST'])
def pick_single_stat_var():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I have one to calculate a statistic with. If I can I will put the variable name into variable. If not I tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\""})
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

@app.route('/pickDoubleStatVars', methods=['POST'])
def pick_double_stat_vars():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I have two of the same type to use to calculate a statistic with. If I can I will put the variable names into the variable1 and variable2. If not I tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\""})
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

@app.route('/pickGraphVars', methods=['POST'])
def pick_graph_vars():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I have enough variables of the same type to make a graph. If I can I will put the x and y variable names into x and y. If not I tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\""})
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


@app.route('/getDes', methods=['POST'])
def get_des():
    name = request.json['name']

    # open all json files in the newHeader folder and make one list of the descriptions
    descriptions = []
    for file in get_files_in_folder("newHeader"):
        data = read_json_file(f"newHeader/{file}")
        descriptions.append(data['embedding'])
    
    # loop through the descriptions, extracting the name by first getting the text after "VARIABLE NAME: " and before " - VARIABLE DESCRIPTION: "
    for i in range(len(descriptions)):
        for j in range(len(descriptions[i])):
            if(descriptions[i][j].split("VARIABLE NAME: ")[1].split(" - VARIABLE DESCRIPTION: ")[0]) == name:
                return jsonify({'description': descriptions[i][j], 'sheet': titles[i]})

@app.route('/pickMapVars', methods=['POST'])
def pick_map_vars():
    messages = request.json['messages']
    messages.append({"role": "assistant", "content": "I will look at the variables listed under \"PROVIDED VARIABLES\" (if there are any) to see if I a variable to map. If we have not pulled the right variable from the database yet I will tell the user why not. I will never make up a variable name that I was not explicitly given under \"PROVIDED VARIABLES\" even if the user has given me that name. If I can not find the right variables I will let the user know that they need to first ask for specific variables and get data tables for those variables. I will tell them to say things like \"Get me median household income for all counties in Texas.\""})
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

@app.route('/outcomeProcess/<num>')
def outcome_process(num):
    data = read_json_file(f"json-des/{num}.json")
    
    outcomes = data['outcomes']
    variables = data['variables']
    
    processed_variables = []
    
    for variable in variables:
        if "[outcome]" in variable['name']:
            for outcome in outcomes:
                new_variable = variable.copy()
                new_variable['name'] = variable['name'].replace("[outcome]", outcome['name'])
                new_variable['description'] = f"{variable['description']} {outcome['description']}"
                processed_variables.append(new_variable)
        else:
            processed_variables.append(variable)
    
    data['variables'] = processed_variables
    
    # Define file paths
    json_des_file_path = os.path.join(os.path.dirname(__file__), 'json-des', f"{num}.json")
    
    # Ensure directories exist
    os.makedirs(os.path.dirname(json_des_file_path), exist_ok=True)
    
    with open(json_des_file_path, 'w') as file:
        json.dump(data, file, indent=2)
    
    return jsonify(data)

@app.route('/geocode', methods=['POST'])
def geocode():
    address = request.json['address']
    url = f"https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address={quote(address)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json"
    response = requests.get(url)
    return jsonify(response.json())

def clean_city_name(city_name):
    cleaned_name = city_name.replace('city', '').strip()
    return ' '.join(cleaned_name.split())

def remove_quotes(string):
    if string.startswith('"') and string.endswith('"'):
        return string[1:-1]
    return string

def find_city_data(data, city_name):
    headers = data[0].split(',')
    rows = data[1:]
    
    try:
        city_index = headers.index('"city"')
        county_name_index = headers.index('"county_name"')
        county_fips_index = headers.index('"county_fips"')
    except ValueError:
        return None, {'error': 'Required columns are missing from the CSV'}
    
    for row in rows:
        row_data = row.split(',')
        if row_data[city_index].lower() == '"' + city_name.lower() + '"':
            return {
                'city': remove_quotes(row_data[city_index]),
                'county_name': remove_quotes(row_data[county_name_index]),
                'county_fips': remove_quotes(row_data[county_fips_index])
            }, None
    
    return None, {'error': 'City not found'}

@app.route('/get_city_data', methods=['GET'])
def get_city_data():
    city_name = request.args.get('city', '').lower()
    
    data = read_csv_file('uscities.csv')
    
    if not data or len(data) < 2:
        return jsonify({'error': 'Invalid data structure in CSV'}), 500
    
    cleaned_city_name = clean_city_name(city_name)
    city_data, error = find_city_data(data, cleaned_city_name)
    
    if city_data:
        return jsonify(city_data)
    else:
        return jsonify(error), 404
    
def remove_county_from_string(input_str):
    return input_str.replace('county', '').replace('County', '').strip()

@app.route('/get_county_code', methods=['GET'])
def get_county_code():
    county_name = remove_county_from_string(request.args.get('county', '').strip().lower())
    
    def find_county_codes(data, county_name):
        matching_counties = []
        for row in data:
            if len(row) >= 2 and remove_county_from_string(row[1].strip().lower()) == county_name:
                matching_counties.append(row[0])
        return matching_counties

    # Path to your CSV file
    file_path = 'countycode-countyname.csv'
    data = read_csv_file(file_path)
    data = [line.split(',') for line in data if line]
    
    if not data:
        return jsonify({'error': 'Invalid data structure in CSV'}), 500
    
    county_codes = find_county_codes(data, county_name)
    
    if county_codes:
        return jsonify({'county_codes': county_codes})
    else:
        return jsonify({'error': 'County not found'}), 404
    
@app.route('/get_state_id', methods=['GET'])
def get_state_id():
    state_name = request.args.get('state', '').strip().lower()

    def find_state_id(data, state_name):
        for row in data:
            if len(row) >= 2 and row[1].strip().lower() == state_name:
                return row[0]
        return None

    file_path = 'states.csv'
    data = read_csv_file(file_path)
    data = [line.split(',') for line in data if line]

    if not data:
        return jsonify({'error': 'Invalid data structure in CSV'}), 500

    state_id = find_state_id(data, state_name)

    if state_id:
        return jsonify({'state_id': state_id})
    else:
        return jsonify({'error': 'State not found'}), 404

# @app.route('/update_state_column', methods=['GET'])
# def update_state_column():
#     state_data = read_csv_file('states.csv')
#     state_data = [line.split(',') for line in state_data if line]
#     state_dict = {row[0].strip(): row[1].strip().title() for row in state_data}  # Ensure state names are title-cased

#     sheet_numbers = [4]
#     for i in sheet_numbers:
#         file_path = f'./sheets/{i}.csv'
#         df = pd.read_csv(file_path)
#         if 'state' in df.columns:
#             df['state'] = df['state'].astype(str).str.strip()  # Ensure state codes are strings and stripped of whitespace
#             df['state_name'] = df['state'].map(state_dict)
                
#             if df['state_name'].isnull().any():
#                 missing_states = df[df['state_name'].isnull()]['state'].unique()
#                 print(f"Missing state mappings for sheet {i}: {missing_states}")
#             else:
#                 print(f"State mappings updated successfully for sheet {i}.")
#         else:
#             print(f"Sheet {i} does not have 'state' column.")
#         df.to_csv(file_path, index=False)

#     return jsonify({'status': 'State columns updated successfully'})

# @app.route('/update_county_column', methods=['GET'])
# def update_county_column():
#     county_data = read_csv_file('countycode-countyname.csv')
#     county_data = [line.split(',') for line in county_data if line]
#     county_dict = {row[0]: row[1].strip() for row in county_data}
#     print("County data loaded successfully.")

#     sheet_numbers = [1, 2, 3, 4, 5, 6, 9, 10, 11]
#     for I in sheet_numbers:
#         file_path = f'./sheets/{I}.csv'
#         df = pd.read_csv(file_path)
#         print(f"Processing file: {file_path}")
#         if 'county' in df.columns and 'state' in df.columns:
#             df['county_code'] = df.apply(lambda x: str(x['state']) + str(x['county']).zfill(3), axis=1)
#             print(f"County codes generated for file: {file_path}")
#             df['county_name'] = df['county_code'].map(county_dict)
#             print(f"County names mapped for file: {file_path}")
#             df.drop(columns=['county_code'], inplace=True)
#         df.to_csv(file_path, index=False)
#         print(f"File saved: {file_path}")

#     return jsonify({'status': 'County columns updated successfully'})

@app.route('/save_report', methods=['POST'])
def save_report():
    report = request.json['data']

    cred = credentials.Certificate('atlas-chat-429014-31385e10f4b1.json')
    try:
        firebase_admin.initialize_app(cred)
    except ValueError:
        pass
    db = firestore.client()

    # get datetime as string with seconds
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # get 10 digit random number
    now += str(random.randint(1000000000, 9999999999))
    doc_ref = db.collection('reports').document(now)
    doc_ref.set({"data": report})

    return jsonify({'status': 'Report saved successfully'})

# @app.route('/create_unique_sheet', methods=['GET'])
# def create_unique_sheet():
#     # Read both CSV files
#     df4 = pd.read_csv('./sheets/4.csv')
#     df5 = pd.read_csv('./sheets/5.csv')
    
#     print("Sheets 4 and 5 loaded successfully.")

#     # Get the column names from both DataFrames
#     columns_4 = set(df4.columns)
#     columns_5 = set(df5.columns)
    
#     # Define the columns to exclude
#     exclude_columns = {"tract"}

#     # Find the columns that are in sheet 5 but not in sheet 4, excluding specified columns
#     unique_columns = columns_5 - columns_4 - exclude_columns

#     # Columns to copy over from sheet 5
#     additional_columns = ["state_name", "state", "county_name", "county", "cz", "czname"]

#     # Ensure the additional columns come first
#     new_df = df5[additional_columns + list(unique_columns)]

#     # Save the new DataFrame to a new CSV file
#     new_file_path = './sheets/unique_columns.csv'
#     new_df.to_csv(new_file_path, index=False)
#     print(f"New sheet created with unique columns and saved to {new_file_path}")

#     return jsonify({
#         'status': 'New sheet created successfully',
#         'file_path': new_file_path
#     })

# @app.route('/edit_cz_columns', methods=['GET'])
# def edit_cz_columns():
#     # Directory containing the CSV files
#     sheets_dir = './sheets'
#     csv_files = [f for f in os.listdir(sheets_dir) if f.endswith('.csv')]

#     for csv_file in csv_files:
#         file_path = os.path.join(sheets_dir, csv_file)
#         df = pd.read_csv(file_path)
        
#         if 'cz' in df.columns:
#             # Remove .0 from all cells in the cz column
#             df['cz'] = df['cz'].astype(str).str.replace(r'\.0$', '', regex=True)
#             df.to_csv(file_path, index=False)
#             print(f"Processed file: {file_path}")

#     return jsonify({'status': 'CZ column cells edited successfully'})

def create_folium_choropleth(gdf, data_column, map_title, state_center, centroids, zoom):
    print("DataFrame columns in create_folium_choropleth:\n", gdf.head())
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
    print("Center of the map:", state_center)
    print("Data column for choropleth:", data_column)
    # Add the choropleth layer
    folium.Choropleth(
        geo_data=geo_json_data,
        data=gdf,
        columns=["GEOID", data_column],
        key_on='feature.properties.GEOID',
        fill_color='YlGnBu',
        fill_opacity=0.7,
        line_opacity=0.2,
    ).add_to(m)

    return m

def get_shapefile_columns(filepath):
    gdf = gpd.read_file(filepath)
    return gdf.columns, gdf.head()

@app.route('/generate_map', methods=['POST'])
def generate_map():
    data = request.json.get('table', [])
    geo_level = request.json.get('geo_level', 'county')

    df = pd.DataFrame(data)

    # Check if multiple states are present
    states = df.iloc[:, 0].unique()

    if len(states) > 1:
        state_fips_list = df.iloc[:, 1].apply(lambda x: str(x).zfill(2)).unique().tolist()
    else:
        state_name = df.iloc[0, 0]
        state_fips = str(df.iloc[0, 1]).zfill(2)
        state_fips_list = [state_fips]

    county_fips = df.iloc[:, 3].apply(lambda x: str(x).zfill(3)).tolist()
    values = df.iloc[:, -1].apply(pd.to_numeric, errors='coerce').tolist()

    if geo_level == 'tract':
        tract_fips = df.iloc[:, 4].apply(lambda x: str(x).zfill(6)).tolist()

    shapefile_path = None

    if geo_level == 'county':
        shapefile_path = 'unzipped/cb_2018_us_county_500k.shp'
    elif geo_level == 'tract':
        tract_files = [os.path.join('unzipped', f) for f in os.listdir('unzipped') if f.endswith('_tract.shp')]
        for tract_file in tract_files:
            gdf = gpd.read_file(tract_file)
            if 'STATEFP' in gdf.columns and gdf['STATEFP'].iloc[0] in state_fips_list:
                shapefile_path = tract_file
                break

    if not shapefile_path:
        return jsonify({"error": "No shapefiles found for the specified geographic level"}), 400

    columns, head = get_shapefile_columns(shapefile_path)
    print(f"Columns in shapefile {shapefile_path}: {columns}")
    print(f"First few rows: {head}")

    if 'STATEFP' not in columns or 'COUNTYFP' not in columns:
        return jsonify({"error": "The required columns STATEFP or COUNTYFP are not in the shapefile"}), 400
    if geo_level == 'tract' and 'TRACTCE' not in columns:
        return jsonify({"error": "The required column TRACTCE is not in the shapefile"}), 400

    geo_df = gpd.read_file(shapefile_path)

    if geo_level == 'county':
        geo_df['GEOID'] = geo_df['STATEFP'] + geo_df['COUNTYFP']
        geo_df = geo_df[geo_df['STATEFP'].isin(state_fips_list)]
        df['GEOID'] = [state_fips + county for state_fips, county in zip(df.iloc[:, 1].apply(lambda x: str(x).zfill(2)).tolist(), county_fips)]
    elif geo_level == 'tract':
        geo_df['GEOID'] = geo_df['STATEFP'] + geo_df['COUNTYFP'] + geo_df['TRACTCE']
        geo_df = geo_df[geo_df['STATEFP'].isin(state_fips_list)]
        df['GEOID'] = [state_fips + county + tract for state_fips, county, tract in zip(df.iloc[:, 1].apply(lambda x: str(x).zfill(2)).tolist(), county_fips, tract_fips)]

    print("GeoDataFrame after adding GEOID:", geo_df.head())
    print("DataFrame to merge:", df.head())

    if 'GEOID' not in df.columns:
        return jsonify({"error": "GEOID column missing in input data"}), 400

    merged = geo_df.set_index('GEOID').join(df.set_index('GEOID'))
    merged.reset_index(inplace=True)

    merged.to_csv('merged_data.csv')
    merged = pd.read_csv('merged_data.csv')

    print("Columns in merged DataFrame before passing to create_folium_choropleth:", merged.columns)
    print("Merged DataFrame:\n", merged.head())

    # Calculate the centroid for each geometry
    centroids = geo_df.geometry.centroid

    xt = 0
    yt = 0
    for cen in centroids:
        xt += cen.x
        yt += cen.y
    state_center = [yt / len(centroids), xt / len(centroids)]
    
    print("Calculated state center:", state_center)
    
    data_column = merged.columns[-1]
    map_title = f'{", ".join(states)} Data Visualization'
    m = ""
    if len(states) > 1:
        m = create_folium_choropleth(merged, data_column, map_title, state_center, centroids, 3.5)
    else:
        m = create_folium_choropleth(merged, data_column, map_title, state_center, centroids, 5.5)

    # Save the map to an HTML string
    map_html = m._repr_html_()

    return jsonify({"html": map_html})

# Below is AI catch
def save_as_csv(sheet_name, data):
    with open(sheet_name, mode='w', newline='') as file:
        writer = csv.writer(file)
        for row in data:
            converted_row = [json.dumps(cell) if isinstance(cell, (dict, list)) else cell for cell in row]
            writer.writerow(converted_row)
    print(f"Data saved to {sheet_name}")

def read_csv(sheet_name):
    data = []
    with open(sheet_name, mode='r') as file:
        reader = csv.reader(file)
        for row in reader:
            converted_row = [json.loads(cell) if cell.startswith('{') or cell.startswith('[') else cell for cell in row]
            data.append(converted_row)
    return data

def reorder(sheet_name):
    data = read_csv(sheet_name)
    sorted_data = sorted(data, key=lambda x: float(x[0]), reverse=True)
    save_as_csv(sheet_name, sorted_data)
    print(f"Data in {sheet_name} sorted by the first column")

def embed(text):
    response = ollama.embeddings(model='mxbai-embed-large', prompt=f'Represent this sentence for searching relevant passages: {text}')
    return response['embedding']

def cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    dot_product = np.dot(vec1, vec2)
    norm_vec1 = np.linalg.norm(vec1)
    norm_vec2 = np.linalg.norm(vec2)
    return dot_product / (norm_vec1 * norm_vec2)

def search(sheet_name, search_term):
    return None
    data = read_csv(sheet_name)
    search_embedding = embed(search_term)
    for row in data:
        if len(row) > 2 and isinstance(row[2], list):
            row_embedding = row[2]
            print(cosine_similarity(search_embedding, row_embedding))
            if cosine_similarity(search_embedding, row_embedding) >= 0.999:
                return row
    return None

def add(sheet_name, obj, response_text):
    data = read_csv(sheet_name)
    obj_str = json.dumps(obj)
    obj_embedding = embed(obj_str)
    
    new_row = [0, obj_str, obj_embedding, response_text]
    data.append(new_row)
    save_as_csv(sheet_name, data)
    reorder(sheet_name)
    return response_text

def chat_completion_request(messages, tools=None, tool_choice=None, model=model):
    # Check if the message already has an embedding and a stored response
    sheet_name = 'responses.csv'
    user_message = json.dumps(messages)
    
    #found_row = search(sheet_name, user_message)
    found_row = False
    
    if found_row:
        found_row[0] = str(int(found_row[0]) + 1)
        data = read_csv(sheet_name)
        for i, row in enumerate(data):
            if row[1] == found_row[1]:
                data[i][0] = found_row[0]
                break
        save_as_csv(sheet_name, data)
        reorder(sheet_name)
        print("Response found in database")

        d1 = read_csv("savedReqs.csv")
        d1[0][0] = str(int(d1[0][0]) + 1)
        save_as_csv("savedReqs.csv", d1)

        print(found_row[-1])

        return parse_function_call_string(found_row[-1])  # Return the value from the response column
    
    try:
        response = openai.chat.completions.create(
             model=model,
             messages=messages,
             tools=tools,
             tool_choice=tool_choice,
             temperature=0,
        )
        # if (tool_choice == None):
        #     tool_choice = "none"
        # response = groq.chat.completions.create(
        # model=model_groq,
        # messages=messages,
        # tools=tools,
        # tool_choice=tool_choice
        # )
        response_text = response.choices[0].message
        # Save the new response
        add(sheet_name, messages, response_text)
        return response_text
    except Exception as e:
        print("Unable to generate ChatCompletion response")
        print(f"Exception: {e}")
        return e

class Function:
    def __init__(self, arguments: str):
        self.arguments = arguments

class ChatCompletionMessageToolCall:
    def __init__(self, id: str, function: Function, name: str, type: str):
        self.id = id
        self.function = function
        self.name = name
        self.type = type

class ChatCompletionMessage:
    def __init__(self, content: Optional[str], role: str, function_call: Optional[str], tool_calls: List[ChatCompletionMessageToolCall]):
        self.content = content
        self.role = role
        self.function_call = function_call
        self.tool_calls = tool_calls

def parse_function_call_string(string: str) -> ChatCompletionMessage:
    # Extract tool calls
    tool_call_matches = re.findall(
        r"ChatCompletionMessageToolCall\(id='(.*?)', function=Function\(arguments='(.*?)', name='(.*?)'\), type='(.*?)'\)", 
        string
    )
    
    tool_calls = []
    for match in tool_call_matches:
        function = Function(arguments=unescape_string(match[1]))
        tool_call = ChatCompletionMessageToolCall(id=match[0], function=function, name=match[2], type=match[3])
        tool_calls.append(tool_call)

    # Extract other details
    print(string)
    content_match = re.search(r"content=(None|'.*?'), role='(.*?)', function_call=(None|'.*?'),", string)
    if (content_match == None):
        content_match = re.search(r"content=(None|.*?), role='(.*?)', function_call=(None|'.*?'),", string)
    print(content_match)
    content = None if content_match.group(1) == "None" else content_match.group(1).strip("'")
    role = content_match.group(2)
    function_call = None if content_match.group(3) == "None" else content_match.group(3).strip("'")
    
    return ChatCompletionMessage(content=unescape_string(content), role=role, function_call=function_call, tool_calls=tool_calls)

# @app.route('/split_sheets', methods=['GET'])
# def split_sheets():
#     # Directory paths
#     sheets_dir = './sheets'
#     labels_dir = './label-col-des'
#     new_sheets_dir = './newSheets'

#     # Create the newSheets directory if it doesn't exist
#     os.makedirs(new_sheets_dir, exist_ok=True)

#     # List of sheet indices to process
#     sheet_indices = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]

#     for index in sheet_indices:
#         print(f"Processing sheet {index}.csv")

#         # Load the label columns for the current sheet
#         label_file_path = os.path.join(labels_dir, f'{index}.json')
#         with open(label_file_path, 'r') as label_file:
#             label_data = json.load(label_file)
#             label_columns = label_data['labelCols']
#             print(f"Loaded label columns for sheet {index}: {label_columns}")

#         # Load the current sheet
#         sheet_file_path = os.path.join(sheets_dir, f'{index}.csv')
#         df = pd.read_csv(sheet_file_path)
#         print(f"Loaded sheet {index}.csv with columns: {df.columns.tolist()}")

#         # Iterate over each column and create new sheets
#         for column in df.columns:
#             if column not in label_columns:
#                 new_df = df[label_columns + [column]]
#                 new_sheet_path = os.path.join(new_sheets_dir, f'{index}_{column}.csv')
#                 new_df.to_csv(new_sheet_path, index=False)
#                 print(f"Created new sheet {new_sheet_path} with columns: {label_columns + [column]}")

#     print("All sheets have been split successfully")
#     return jsonify({"message": "Sheets have been split successfully"}), 200


# new flask endpoint
# @app.route('/remakeDes', methods=['GET'])
# def remake_des():
#     names = ['1', '4', '9', '12']
#     for name in names:
#         data = read_json_file(f"newHeader/{name}.json")
#         variables = data['embedding']
#         for variable in variables:
#             messages = [
#                 {"role": "system", "content": "You are rewriting these confusing descriptions to make them clear and concise. These variables are from a paper written about the USA. Only use information given from the description. Do not make up information or make the description complicated."},
#                 {"role": "user", "content": f"Please remake the following description. Do not include anything other than the description in your response. Do not use formatting in your response. Your response will be displayed next to the variable name in a table, so there is no need to explicitly mention it. The descriptions are general for all race, gender, and percentile, but the variable names are specific. This means that when writing a description you must use the information from he variable name.\n\n{variable}"}
#             ]

#             function = {
#                 "name": "remake_description",
#                 "description": "Summarize the provided description to make it clear and concise.",
#                 "parameters": {
#                     "type": "object",
#                     "properties": {
#                         "description": {"type": "string", "description": "The rewritten description, with no information not provided added to it."}
#                     },
#                     "required": ["description"]
#                 }
#             }

#             response = function_langchain(messages, function, "remake_description")

#             print(variable)
#             print(response)
#             print("\n\n")

# new flask endpoint
# @app.route('/remakeDes', methods=['GET'])
# def remake_des():
#     names = ['1', '4', '9', '12']
#     for name in names:
#         data = read_json_file(f"newHeader/{name}.json")
#         variables = data['embedding']
#         for variable in variables:
#             messages = [
#                 {"role": "system", "content": "You are rewriting these descriptions as examples queries that a user might use when asking for this variable. Do not include the variable name in the query and do not just copy the description."},
#                 {"role": "user", "content": f"Please remake the following description as queries. \n\n{variable}"}
#             ]

#             function = {
#                 "name": "remake_description",
#                 "description": "A function to get the query.",
#                 "parameters": {
#                     "type": "object",
#                     "properties": {
#                         "query": {"type": "string", "description": "The rewritten description rewritten as a query. This should not just be a copy of the description. It should be rewritten to feel human and natural. It should feel like a real human being who is not an expert in the field would ask for this variable. Make sure to include race, gender, and percentile information from the variable name. For example, if the name includes asian, make sure to include asian in the query."},
#                     },
#                      "required": ["description"]
#                 }
#             }

#             response = function_langchain(messages, function, 1, "remake_description")

#             print(variable)
#             print(response)
#             print("\n\n")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/viewData')
def new_data():
    return render_template('viewData.html')

if __name__ == '__main__':
    app.run(port=3000)

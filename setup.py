# This file contains functions that were used to construct the database and calculate the embeddings

# Import statements
from flask import Flask, jsonify
from flask_cors import CORS
import json
import os
import pandas as pd

# Imports functions from main
from Flask.main import *

# Configures Flask app, disabling CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Takes in a number corresponding to a sheet
# Reads in the json file continuing the descriptions for the variables in that sheet along with the outcomes and their descriptions
# Replaces the [outcome] tag in the variable names with the outcome names and saves the new json file over the old one
@app.route('/outcomeProcess/<num>')
def outcome_process(num):
    data = read_json_file(f"description_units/{num}.json")
    
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
    json_des_file_path = os.path.join(os.path.dirname(__file__), 'description_units', f"{num}.json")
    
    # Ensure directories exist
    os.makedirs(os.path.dirname(json_des_file_path), exist_ok=True)
    
    with open(json_des_file_path, 'w') as file:
        json.dump(data, file, indent=2)
    
    return jsonify(data)

# Takes in a number corresponding to a sheet
# Adds a new colum to that sheet with the name of the state that each row corresponds too
@app.route('/update_state_column/<num>', methods=['GET'])
def update_state_column(num):
    state_data = read_csv_file('states.csv')
    state_data = [line.split(',') for line in state_data if line]
    state_dict = {row[0].strip(): row[1].strip().title() for row in state_data}  # Ensure state names are title-cased

    file_path = f'./headers/{num}.csv'
    df = pd.read_csv(file_path)
    if 'state' in df.columns:
        df['state'] = df['state'].astype(str).str.strip()  # Ensure state codes are strings and stripped of whitespace
        df['state_name'] = df['state'].map(state_dict)
            
        if df['state_name'].isnull().any():
            missing_states = df[df['state_name'].isnull()]['state'].unique()
            print(f"Missing state mappings for sheet {num}: {missing_states}")
        else:
            print(f"State mappings updated successfully for sheet {num}.")
    else:
        print(f"Sheet {num} does not have 'state' column.")
    df.to_csv(file_path, index=False)

    return jsonify({'status': 'State columns updated successfully'})

# Takes in a number corresponding to a sheet
# Adds a new colum to that sheet with the name of the county that each row corresponds too
@app.route('/update_county_column/<num>', methods=['GET'])
def update_county_column(num):
    county_data = read_csv_file('countycode-countyname.csv')
    county_data = [line.split(',') for line in county_data if line]
    county_dict = {row[0]: row[1].strip() for row in county_data}
    print("County data loaded successfully.")

    file_path = f'./headers/{num}.csv'
    df = pd.read_csv(file_path)
    print(f"Processing file: {file_path}")
    if 'county' in df.columns and 'state' in df.columns:
        df['county_code'] = df.apply(lambda x: str(x['state']) + str(x['county']).zfill(3), axis=1)
        print(f"County codes generated for file: {file_path}")
        df['county_name'] = df['county_code'].map(county_dict)
        print(f"County names mapped for file: {file_path}")
        df.drop(columns=['county_code'], inplace=True)
    df.to_csv(file_path, index=False)
    print(f"File saved: {file_path}")

    return jsonify({'status': 'County columns updated successfully'})

# Creates a new sheet that represents all the columns in sheet 5 that are not in sheet 4
# This is important because 4 and 5 generally have the same variables in them, but sheet 5 has a few more
# In sheet 4 each row is a census tract. In sheet 5 each row is a county
@app.route('/create_unique_sheet', methods=['GET'])
def create_unique_sheet():
    # Read both CSV files
    df4 = pd.read_csv('./headers/4.csv')
    df5 = pd.read_csv('./headers/5.csv')
    
    print("Sheets 4 and 5 loaded successfully.")

    # Get the column names from both DataFrames
    columns_4 = set(df4.columns)
    columns_5 = set(df5.columns)
   
    # Define the columns to exclude
    exclude_columns = {"tract"}

    # Find the columns that are in sheet 5 but not in sheet 4, excluding specified columns
    unique_columns = columns_5 - columns_4 - exclude_columns

    # Columns to copy over from sheet 5
    additional_columns = ["state_name", "state", "county_name", "county", "cz", "czname"]

    # Ensure the additional columns come first
    new_df = df5[additional_columns + list(unique_columns)]

    # Save the new DataFrame to a new CSV file
    new_file_path = './headers/unique_columns.csv'
    new_df.to_csv(new_file_path, index=False)
    print(f"New sheet created with unique columns and saved to {new_file_path}")

    return jsonify({
        'status': 'New sheet created successfully',
        'file_path': new_file_path
    })

# Reads through the cz column of all sheets in the sheets folder and remove the .0 from all cells if it is their
@app.route('/edit_cz_columns', methods=['GET'])
def edit_cz_columns():
    # Directory containing the CSV files
    sheets_dir = './sheets'
    csv_files = [f for f in os.listdir(sheets_dir) if f.endswith('.csv')]

    for csv_file in csv_files:
        file_path = os.path.join(sheets_dir, csv_file)
        df = pd.read_csv(file_path)
       
        if 'cz' in df.columns:
            # Remove .0 from all cells in the cz column
            df['cz'] = df['cz'].astype(str).str.replace(r'\.0$', '', regex=True)
            df.to_csv(file_path, index=False)
            print(f"Processed file: {file_path}")

    return jsonify({'status': 'CZ column cells edited successfully'})

# Goes through all the sheets in the sheets folder
# For each sheet breaks the sheet down into multiple sheets with only one column each
# Saves the new sheets in the data_columns folder
@app.route('/split_sheets', methods=['GET'])
def split_sheets():
    # Directory paths
    sheets_dir = './sheets'
    new_sheets_dir = './data_columns'

    # Create the newSheets directory if it doesn't exist
    os.makedirs(new_sheets_dir, exist_ok=True)

    # List of sheet indices to process
    sheet_indices = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]

    for index in sheet_indices:
        print(f"Processing sheet {index}.csv")

        # Load the current sheet
        sheet_file_path = os.path.join(sheets_dir, f'{index}.csv')
        df = pd.read_csv(sheet_file_path)
        print(f"Loaded sheet {index}.csv with columns: {df.columns.tolist()}")

        # Iterate over each column and create new sheets
        for column in df.columns:
            new_df = df[[column]]
            new_sheet_path = os.path.join(new_sheets_dir, f'{index}_{column}.csv')
            new_df.to_csv(new_sheet_path, index=False)
            print(f"Created new sheet {new_sheet_path} with column: {column}")

    print("All sheets have been split successfully")
    return jsonify({"message": "Sheets have been split successfully"}), 200

# Removes all the data from all the sheets in the sheets folder, leaving only the headers
@app.route('/truncate_sheets', methods=['GET'])
def truncate_sheets():
    # Directory path
    sheets_dir = './sheets'

    # List all CSV files in the directory
    for filename in os.listdir(sheets_dir):
        if filename.endswith('.csv'):
            file_path = os.path.join(sheets_dir, filename)

            # Load the CSV file
            df = pd.read_csv(file_path)

            # Get the header row (column names)
            header = df.columns

            # Create a new DataFrame with only the header
            truncated_df = pd.DataFrame(columns=header)

            # Save the truncated DataFrame back to the same file
            truncated_df.to_csv(file_path, index=False)

            print(f"Truncated file: {filename}")

    return jsonify({"message": "All sheets have been truncated successfully"}), 200

# Takes in an integer sheet name and creates a json file with the variable names and descriptions for that sheet
@app.route('/makeDes/<num>', methods=['GET'])
def make_des(num):
    num = int(num)

    # Loads header and description data
    headers = get_header_row(f'./headers/{num}.csv')
    descriptions = get_descriptions(f'./description_units/{num}.json')

    # Matches the headers with the descriptions
    header_descriptions = match_headers_with_descriptions(headers, descriptions)
    merged_headers_descriptions = merge_headers_with_descriptions(headers, header_descriptions)

    # Saves the variable names and descriptions to a json file and returns it
    save_embedding(merged_headers_descriptions, f'header_description/{num}.json')
    return jsonify({'processed': "All done!"})

# Takes in an integer sheet name and calculates and saves the embeddings for the variables in that sheet
@app.route('/headers/<num>', methods=['GET'])
def get_headers(num):
    num = int(num)
    
    # Gets the unique variable names, descriptions, and units with things like p1, black, and mean removed from them
    stripped_names_and_descriptions = get_stripped_names_and_descriptions(num)
    merged_headers_descriptions = stripped_names_and_descriptions["merged_headers_descriptions"]
    matched_headers = stripped_names_and_descriptions["matched_headers"]

    # Calculates the embeddings
    embeddings = prep_embedding_list(get_embedding_throttled(merged_headers_descriptions))

    # Sets the embeddings to be all 0 for any variable that is a label column
    label_cols = read_json_file(f"label_col_names/{num}.json")['labelCols']
    for i in range(len(embeddings)):
        if (matched_headers[i]["header"] in label_cols):
            for j in range(len(embeddings[i])):
                embeddings[i][j] = 0
    
    # Saves and returns the embeddings
    save_embedding(embeddings, f'embeddings/{num}.json')
    return jsonify({'mergedHeadersDescriptions': merged_headers_descriptions, 'embeddings': embeddings})

# Renames all the files in the map_data folder that relate to census tracts in a state
# Gives all files for each state the same name, which is the state's FIPS code
@app.route('/rename_files', methods=['GET'])
def rename_files():
    directory = 'map_data'
    shapefiles = [f for f in os.listdir(directory) if f.endswith('.shp')]

    renamed_files = {}
    for shapefile in shapefiles:
        try:
            # Load the shapefile
            gdf = gpd.read_file(os.path.join(directory, shapefile))

            # Skip county files
            if shapefile == 'cb_2018_us_county_500k.shp':
                print(f"Skipping county file: {shapefile}")
                continue

            # Remove columns ending with "10"
            gdf.columns = [col[:-2] if col.endswith('10') else col for col in gdf.columns]

            # Determine FIPS code for tract files
            if 'STATEFP' in gdf.columns:
                fips_code = gdf['STATEFP'].iloc[0]
            else:
                continue  # Skip files that do not match expected structure

            # Create new base name based on FIPS code
            base_name = f"{fips_code}"
            old_base_name = os.path.splitext(shapefile)[0]

            # Get all related files (shp, shx, dbf, prj, etc.)
            related_files = [f for f in os.listdir(directory) if f.startswith(old_base_name)]
            for file in related_files:
                old_path = os.path.join(directory, file)
                new_filename = file.replace(old_base_name, base_name)
                new_path = os.path.join(directory, new_filename)

                # Rename file
                os.rename(old_path, new_path)
                print(f"Renamed {old_path} to {new_path}")

            renamed_files[base_name] = [file.replace(old_base_name, base_name) for file in related_files]

        except Exception as e:
            print(f"Error processing {shapefile}: {e}")
            continue

    return jsonify({'renamed_files': renamed_files}), 200

if __name__ == '__main__':
    app.run(port=3000)
# This file contains functions that were used to construct the database and calculate the embeddings

"""
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

@app.route('/update_state_column', methods=['GET'])
def update_state_column():
    state_data = read_csv_file('states.csv')
    state_data = [line.split(',') for line in state_data if line]
    state_dict = {row[0].strip(): row[1].strip().title() for row in state_data}  # Ensure state names are title-cased

    sheet_numbers = [4]
    for i in sheet_numbers:
        file_path = f'./sheets/{i}.csv'
        df = pd.read_csv(file_path)
        if 'state' in df.columns:
            df['state'] = df['state'].astype(str).str.strip()  # Ensure state codes are strings and stripped of whitespace
            df['state_name'] = df['state'].map(state_dict)
                
            if df['state_name'].isnull().any():
                missing_states = df[df['state_name'].isnull()]['state'].unique()
                print(f"Missing state mappings for sheet {i}: {missing_states}")
            else:
                print(f"State mappings updated successfully for sheet {i}.")
        else:
            print(f"Sheet {i} does not have 'state' column.")
        df.to_csv(file_path, index=False)

    return jsonify({'status': 'State columns updated successfully'})

@app.route('/update_county_column', methods=['GET'])
def update_county_column():
    county_data = read_csv_file('countycode-countyname.csv')
    county_data = [line.split(',') for line in county_data if line]
    county_dict = {row[0]: row[1].strip() for row in county_data}
    print("County data loaded successfully.")

    sheet_numbers = [1, 2, 3, 4, 5, 6, 9, 10, 11]
    for I in sheet_numbers:
        file_path = f'./sheets/{I}.csv'
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

@app.route('/create_unique_sheet', methods=['GET'])
def create_unique_sheet():
    # Read both CSV files
    df4 = pd.read_csv('./sheets/4.csv')
    df5 = pd.read_csv('./sheets/5.csv')
    
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
    new_file_path = './sheets/unique_columns.csv'
    new_df.to_csv(new_file_path, index=False)
    print(f"New sheet created with unique columns and saved to {new_file_path}")

    return jsonify({
        'status': 'New sheet created successfully',
        'file_path': new_file_path
    })

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

@app.route('/split_sheets', methods=['GET'])
def split_sheets():
    # Directory paths
    sheets_dir = './sheets'
    labels_dir = './label-col-des'
    new_sheets_dir = './newSheets'

    # Create the newSheets directory if it doesn't exist
    os.makedirs(new_sheets_dir, exist_ok=True)

    # List of sheet indices to process
    sheet_indices = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]

    for index in sheet_indices:
        print(f"Processing sheet {index}.csv")

        # Load the label columns for the current sheet
        label_file_path = os.path.join(labels_dir, f'{index}.json')
        with open(label_file_path, 'r') as label_file:
            label_data = json.load(label_file)
            label_columns = label_data['labelCols']
            print(f"Loaded label columns for sheet {index}: {label_columns}")

        # Load the current sheet
        sheet_file_path = os.path.join(sheets_dir, f'{index}.csv')
        df = pd.read_csv(sheet_file_path)
        print(f"Loaded sheet {index}.csv with columns: {df.columns.tolist()}")

        # Iterate over each column and create new sheets
        for column in df.columns:
            if column not in label_columns:
                new_df = df[label_columns + [column]]
                new_sheet_path = os.path.join(new_sheets_dir, f'{index}_{column}.csv')
                new_df.to_csv(new_sheet_path, index=False)
                print(f"Created new sheet {new_sheet_path} with columns: {label_columns + [column]}")

    print("All sheets have been split successfully")
    return jsonify({"message": "Sheets have been split successfully"}), 200

@app.route('/split_sheets', methods=['GET'])
def split_sheets():
    # Directory paths
    sheets_dir = './sheets'
    new_sheets_dir = './newSheets_1'

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
    headers = get_header_row(f'./sheets/{num}.csv')
    descriptions = get_descriptions(f'./json-des/{num}.json')

    # Matches the headers with the descriptions
    header_descriptions = match_headers_with_descriptions(headers, descriptions)
    merged_headers_descriptions = merge_headers_with_descriptions(headers, header_descriptions)

    # Saves the variable names and descriptions to a json file and returns it
    save_embedding(merged_headers_descriptions, f'newHeader/{num}.json')
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
    label_cols = read_json_file(f"label-col-des/{num}.json")['labelCols']
    for i in range(len(embeddings)):
        if (matched_headers[i]["header"] in label_cols):
            for j in range(len(embeddings[i])):
                embeddings[i][j] = 0
    
    # Saves and returns the embeddings
    save_embedding(embeddings, f'embedding/{num}.json')
    return jsonify({'mergedHeadersDescriptions': merged_headers_descriptions, 'embeddings': embeddings})
"""
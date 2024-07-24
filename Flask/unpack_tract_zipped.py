import os
import zipfile

# Path to the directory containing the zipped folders
zipped_dir = 'zipped/'
unzipped_dir = 'unzipped/'

# Create the unzipped directory if it doesn't exist
os.makedirs(unzipped_dir, exist_ok=True)

# Iterate over all files in the zipped directory
for file_name in os.listdir(zipped_dir):
    if file_name.endswith('.zip'):
        # Construct full file path
        file_path = os.path.join(zipped_dir, file_name)
        
        # Open the zip file
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            # Extract all files to the unzipped directory
            zip_ref.extractall(unzipped_dir)
            # Move the files to the unzipped directory (in case they're nested inside folders)
            for file in zip_ref.namelist():
                os.rename(os.path.join(unzipped_dir, file), os.path.join(unzipped_dir, os.path.basename(file)))

print("All files have been extracted to the unzipped directory.")
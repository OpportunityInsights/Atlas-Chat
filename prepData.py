import json

# Read in the text from paper.txt
with open('paper.txt', 'r') as file:
    paper_text = file.read()

# Split the text into sentences or chunks for the example
chunks = paper_text.split('. ')

# Form the JSON structure as specified
example_dataset = [
    {
        "instruction": "",
        "input": chunks[i].strip(),
        "output": chunks[i+1].strip() if i+1 < len(chunks) else "",
        "system": "",
        "history": []
    }
    for i in range(0, len(chunks)-1, 2)
]

# Save the formatted JSON structure to a file
with open('formatted_data.json', 'w') as json_file:
    json.dump(example_dataset, json_file, indent=2)

print("Formatted JSON data has been saved to 'formatted_data.json'")
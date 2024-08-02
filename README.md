# Atlas Chat 🌐 👋

## Overview

Hello! Welcome to Atlas Chat. This README goes over all the information you should need to understand the code, run the website, and continue development. If you have any questions, feel free to reach out to me at [maxlaibson@gmail.com](mailto:maxlaibson@gmail.com).

## Table of Contents

- [Features](#usage)
- [Installation](#installation)
- [Hosting](#hosting)
- [Inner Workings](#inner-workings)
- [Problems & Possible Next Steps](#problems--possible-next-steps)
- [Contact](#contact)

## Features

Atlas chat is designed to help users explore [data](https://opportunityinsights.org/data/) from the [Opportunity Atlas Paper](https://opportunityinsights.org/paper/the-opportunity-atlas/). The chat can:

1. Find variables
    - Users can search for different topics, races, genders, and percentiles
2. Get location specific data
    - Data is available for specific census tracts, counties, and commuting zones
    - Users can also gets tables with variables for all US counties, all the counties in a specific state, or all the census tracts in a specific state
3. Calculate statistics
    - The chat can calculate the mean, median, standard deviation, and correlation
4. Make choropleth maps
    - Maps are available for all the counties in the US, all the counties in a state, all the census tracts in the US, and all the census tracts in a state
5. Make scatter plots
6. Answer questions

In addition to these features, Atlas Chat also has a dedicated data download page where users can download the the variables mentioned in their conversations for different races, genders, percentiles, and geographic levels.

The website also has an error reporting features that sends the contents of the chat along with the contents of the console and the user entered error reporting message to a [FireStore](https://cloud.google.com/firestore?hl=en) database.

## Installation

First, clone this repository.

```bash
git clone https://github.com/xamxl/OIP3.git
```
Next, navigate the Flask folder and install the python requirements.

```bash
cd OIP3/Flask
pip install -r requirements.txt
```
The one tricky part is that you now need your own OpenAI API key and Google Cloud service account (If you want error reporting to work). You can get an OpenAI API key [here](https://platform.openai.com/docs/overview) and a service account [here](https://cloud.google.com/iam/docs/keys-create-delete). Later, if you get a Google Cloud service account, put your json key into the atlas-chat-429014-31385e10f4b1.json file.

Now, run the python file to start the server.

```bash
python main.py
```
Finally, navigate to the [localhost](http://127.0.0.1:3000/). Thats it! 🎉

## Hosting

## Inner Workings

## Problems & Possible Next Steps

## Contact

- [GitHub](https://github.com/xamxl)
- [Email](mailto:maxlaibson@gmail.com)

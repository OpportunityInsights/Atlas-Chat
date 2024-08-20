# Atlas Chat 🌐 👋

## Overview

Hello! Welcome to Atlas Chat. This README contains all the information you need to understand the code, run the website, and continue development. If you have any questions, please contact me at [maxlaibson@gmail.com](mailto:maxlaibson@gmail.com).

## Table of Contents

- [Features](#usage)
- [Installation](#installation)
- [Hosting](#hosting)
- [LLM Vocabulary](#llm-vocabulary)
- [Structure](#structure)
- [Inner Workings](#inner-workings)
- [Problems & Possible Next Steps](#problems--possible-next-steps)
- [Contact](#contact)

## Features

Atlas chat is designed to help users explore [data](https://opportunityinsights.org/data/) from the [Opportunity Atlas Paper](https://opportunityinsights.org/paper/the-opportunity-atlas/). The chat can:

1. Find variables
    - Users can search for variables related to various topics and broken down by race, gender, and parent income percentile
2. Get location-specific data
    - Data is available for specific census tracts, counties, and commuting zones
    - Users can also get tables with data for all US counties, all the counties in a specific state, or all the census tracts in a specific state
3. Calculate statistics
    - The chat can calculate mean, median, standard deviation, and correlation
4. Make choropleth maps
    - Maps are available for all the counties in the US, all the counties in a state, and all the census tracts in a state
5. Make scatter plots
6. Answer questions

In addition to these features, Atlas Chat has a data download page where users can download the variables mentioned in their conversations for different races, genders, percentiles, and geographic levels.

The website also has an error reporting feature that sends the contents of the chat, the contents of the console, and a message entered by the user describing the problem to a [FireStore](https://cloud.google.com/firestore?hl=en) database.

Watch [this video](https://www.youtube.com/watch?v=9a4H78gThJw) to understand how users can interact with the chat. 📹

## Installation

First, open the terminal in a directory of your choosing and clone this repository.

```bash
git clone https://github.com/xamxl/Atlas-Chat.git
```
Next, navigate to the `Flask` folder and install the Python requirements.

```bash
cd Atlas-Chat/Flask
python -m pip install --upgrade pip
pip install -r requirements.txt
```
You now need your own OpenAI API key and Google Cloud service account (If you want error reporting to work). You can get an OpenAI API key [here](https://platform.openai.com/docs/overview) and a service account [here](https://cloud.google.com/iam/docs/keys-create-delete). Put the OpenAI API key in the `.env` file. If you get a Google Cloud service account, put your JSON key into the `atlas-chat-gcloud-key.json` file.

Now, run the Python file to start the server.

```bash
python main.py
```
Finally, navigate to the [localhost](http://127.0.0.1:3000/). That's it! 🎉

## Hosting

For now, if you want to quickly make a shareable link, you can upload the whole program to [Google Cloud Run](https://cloud.google.com/run/?utm_source=google&utm_medium=cpc&utm_campaign=na-US-all-en-dr-bkws-all-all-trial-e-dr-1707554&utm_content=text-ad-none-any-DEV_c-CRE_665665924930-ADGP_Hybrid+%7C+BKWS+-+MIX+%7C+Txt-Serverless+Computing-Cloud+Run-KWID_43700077224933166-kwd-678836618089&utm_term=KW_google+cloud+run-ST_google+cloud+run&gad_source=1&gclid=Cj0KCQjwh7K1BhCZARIsAKOrVqGkYjouOnjAaTGADV02ZOaRybrk_BuAbY7DdY0i_b9Xr3Kin24g4tgaAuaIEALw_wcB&gclsrc=aw.ds&hl=en). Google cloud run is great because you can easily control how powerful the server is. The chat runs best when you give each instance maximum power, 8 VCPUs and 32 GB of memory. To scale the server up or down you can change the maximum number of instance. Note that once instance can support at least 20 users at once, and that the maximum number of instances is 100.

To do this, first, go to the `script.js` file in the project and replace all occurrences of http\:\/\/<i></i>127\.0\.0\.1\:3000\/ with the link to your Google Cloud Run deployment. You may need to deploy twice, once to figure out what this link is and another time with this link in the code.

Then set up a Google Cloud account and install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install). Navigate to the `Flask` folder and build the docker image.

```bash
cd Atlas-Chat/Flask
gcloud run deploy
```
You may have to wait a while for the files to upload, but after that, the SDK will print out a link in the console and you will be all good to go. ☁️ 🔗

## LLM Vocabulary

OpenAI offers two services through its API that are used in this project: text generation with chat-GPT and embedding generation.

Text generation involves providing a prompt to a model like gpt-4o and receiving a text-based response. For example, if you prompt “Tell me about standard deviation,” the model might respond with: “Standard deviation is a measure of the amount of variation or dispersion in a set of values. It indicates how much the individual data points in a dataset differ from the mean (average) of the dataset.”

Embedding generation involves inputting text into a model, such as text-embedding-3-large, and receiving a vector representing the meaning of the text. These embeddings are useful in search processes because the distance between two vectors can easily be calculated. A small distance indicates that the two pieces of text have similar meanings.

While simple text generation is sufficient for many applications, there are cases where it’s more helpful for chat-GPT to provide a structured response that can be used to trigger specific functions. For instance, if a user asks, “What is the weather in Boston?”, it would be ideal if chat-GPT could return a JSON object specifying the name of a function to call for retrieving the weather, along with the relevant parameters, such as the city name “Boston”. Luckily, chat-GPT has this ability to generate a function call during text generation.

A function call allows the model to output a structured response instead of plain text. When a function call is enabled, the model can either respond with plain text or a JSON object with the necessary parameters to execute a specific function. There is a parameter that forces chat-GPT to always use a function call for certain prompts, ensuring that it consistently provides structured outputs instead of plain text.

## Structure

The image below shows the structure of the program. The program is divided into four main parts. First, there is a webpage consisting of HTML, CSS, and JS. This front end, which runs on the user's computer, can make requests to a backend server programmed in Python using the Flask library. The backend server can get data from the sheets and other files stored in the database. Finally, the backend can make requests to the OpenAI API.

![Image that shows how the structure of the chat.](structure.jpeg)

### Understanding OI Data

To see the raw data this chat has access to, please [click here](https://opportunityinsights.org/data/) and scroll down to "The Opportunity Atlas: Mapping the Childhood Roots of Social Mobility".

In this section, there are 13 subsections. Atlas Chat has access to the CSV files from all subsections except "Crosswalk Between 2010 and 2020 US Census Tracts" and "Replication Package". In the code, the subsections that it can access are numbered 1 to 11, with 1 corresponding to "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender" and 11 corresponding to "Neighborhood Characteristics by Commuting Zone". Sheet 12 contains the variables present in sheet 5 but not sheet 4.

All of these sheets consist of columns which each hold the data for a specific varaible. Variables generally have an category and then may have a race, gender, percentile, and statistic type. Examples of cateogires include median income, high school graduation rates, and marrage rates. The races are black, white, natam, hisp, asian, other, and pooled. The genders are male, female, and pooled. The percentiles are p1, p10, p25, p50, p75, and p100. The statistics are mean, n, se, imp, and mean_se. For example, one column is hs_male_black_mean, which is the mean rate of highschool graduation for black men who grew up in a specific area.

Some folders in the program only contain sheets 1, 4, 9, and 12. This is because these sheets collectively contain all the variables in the database. The other sheets contain these same variables for different geographical levels. The geographical levels are census tract, county, and commuting zone.

### File Structure of Repository

The list below goes over each file in the project, where is is located, and what its purpose is.

- `flowchart.jpeg`: Used in the README
- `structure.jpeg`: Used in the README
- `README.md`: A file that helps explain the code
- `setup.py`: Contains the code that was used to construct the database
- `.gitignore`: Prevents sensitive files from uploading to GitHub
- `Flask`: Contains the application itself, including the files for the front end, Flask backend, and database. When running the program, the whole `Flask` folder is part of the execution
    - `.env`: Stores the OpenAI API key
    - `atlas-chat-gcloud-key.json`: Stores the Google Cloud service account key
    - `countycode-countyname.csv`: Stores a table converting county codes to county names
    - `states.csv`: Stores a table converting state names to state IDs
    - `merged_data.csv`: Populated anew each time the server makes a map. There is no need to know what is in this file
    - `requirements.txt`: Lists the Python packages that need to be installed to run the Flask server
    - `main.py`: Contains the server code
    - `static`: Stores the CSS, JS, and images that `main.py` gives to the user's computer when it loads the page
    - `templates`: Stores the HTML that `main.py` gives to the user's computer when it loads the page
    - `map_data`: Contains files with information about the outlines of US counties and census tracts. Used to contruct maps
    - `headers`: Contains CSV sheets, each with only one row. This row contains the header names for all the columns in that sheet
    - `data_columns`: Contains the data itself. Each column from the original data was turned into its own sheet named with the number of the sheet the data came from and then the variable name
    - `header_description`: Contains files with descriptions for each variable. There are only four files (fewer files than there are sheets) since many of the sheets have the same variables, just for different geographical levels
    - `label_col_names`: Holds the names of the label columns for each sheet. Examples of label columns are state ID, state name, county name, and county ID
    - `descriptions_units`: Contains each variable name and its description. Importantly these variables do not specify race, gender, or percentile. For example, `descriptions_units` may contain a variable called kfr_\[race]_\[gender]_mean. `descriptions_units` also contains information on the sheets' units and the different outcomes in each sheet. Think of `descriptions_units` as the information from the README on Opportunity Insights' data page
    - `embeddings`: Contains the embeddings themselves. All columns in the sheets have a corresponding embedding, but each embedding normally corresponds to multiple columns. For example, kfr_pooled_pooled_mean and kfr_black_pooled_mean both have the same embedding. The embeddings for all label columns are set to zero

## Inner Workings

This section explains how the code works. Please look through the following flowchart before reading the text since this section references the image.

![Flowchart that shows how the chat works.](flowchart.jpeg)

### Mode Decision: What does the user want?

When the user sends a message to the chat, [sendMessage()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L362) in `script.js` begins handling the request. The function adds the user's message to the `messages` list and calls [useCase()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L836) which makes a server call to determine which action the chat should take. [/useCase](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L648) in the server uses a function call from the OpenAI API to make the decision. This represents the first box in the flow chart. `sendMessage()` ultimately calls the right function(s) based on what branch of the flow chart the function call picks.

### Pick Variable, Pick Two Variables, Pick Two Graphing Variables, Pick Mapping Variables

If `/useCase` decides the user wants the chat to calculate a statistic or make a figure, `sendMessage()` calls one of the functions that corresponds to one of these branches of the flow chart. For illustration, this description will follow the branch the chat picks if it thinks the user wants to make a scatter plot.

In this case [requestGraphVars()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L728) starts by calling [requestVar()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L770) which constructs a list of all the available variables and sends them to the server. [/pickGraphVars](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L707) in the server uses a function call from the OpenAI API to decide which variables should be used or to write a message describing why the right variables were not available. Back in `requestGraphVars()` the chat either prints out the text describing why the right variables were not found or calls [graphVariable()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L1648) to create the graph with the variables the server selected.

> [!WARNING]
> There is a bug in the code. The map download feature is not fully functional.

### Extract Prompt: What do I ask the database for?

In this branch of the flow chart, `sendMessage()` starts by calling [variableSearch()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L426). This function calls [/formulateQueryOrRespond](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L605) in the server which uses a function call from the OpenAI API to either directly respond to the user or fill out the fields required to search for a variable. These fields include race, gender, percentile, location, and query (the keywords to use in the search).

Back in `variableSearch()`, the chat either prints out the response from the server or gets the values of all the fields so that `sendMessage()` can call the right function to find variables for the user. For example, if the user asks a question like "What is a standard deviation?" then the chat will answer the question directly while in this part of the flow chart. If the user says, "Get me a median household income variable." then the flow chart will reach this stage and move on to Search after it collects the search fields.

### Search

In this branch of the flow chart, `sendMessage()` starts by calling [fetchData()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L849) which calls [/getRankedVariables](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L581) in the server with the key words the previous function call said should be used for the search. `/getRankedVariables` calls [getRankedVariables()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L246) which gets the embeddings of the key words using the OpenAI API.

The rest of this description uses the following example: the key words are "high school completion rate" which means the variables `getRankedVariables()` should return first are hs_pooled_pooled_mean, hs_pooled_female_mean, and hs_pooled_male_mean.

To find these variables `getRankedVariables()` goes to the database and gets a set of precalculated embeddings. These embeddings each represent multiple variables. For example, hs_pooled_pooled_mean, hs_pooled_female_mean, and hs_pooled_male_mean are represented by the same embedding made with the text "hs - the fraction of children who completed high school." `getRankedVariables()` uses cosine similarity to calculate the distances between the embedding of the user's key words and the precalculated embeddings.

Next, `getRankedVariables()` calculates "dumb distance", which is the fraction of the user's key words that appear in each of the texts that were used to make the precalculated embeddings. For example, the text "hs - the fraction of children who completed high school" would have a "dumb distance" of 0.75 since "high", "school", and "completion" are all in the text but "rate" is not.

The two different distance metrics are then combined, weighing the cosine similarity by 0.8 and the "dumb distance" by 0.2. The specific values 0.8 and 0.2 were choosen by trying different ratios and seeing which ratio regularly returned the most relevant variables. The cosine similarity embedding distance is used so that terms like "upward mobility" which do not appear in the texts used to make the precalculated embeddings can be matched with phrases from the texts with similar meanings. The "dumb distance" is used so that terms like "individual" which do appear in the texts but whose meaning isn't picked up by the embedding model can still impact the search.

Finally, `getRankedVariables()` creates a list of all the variable names in the database ordered by the distance between the text they correspond to and the users's key words. For example, in this case, the list could start with hs_pooled_pooled_mean, hs_pooled_female_mean, and hs_pooled_male_mean. The lower the index of a variable in the list the closer the variable is to the key words. Strings with the variable description and the name of the sheet the variable is from are added to the variable list.

The front end receives the resulting list and `sendMessage()` calls  [makeTable()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L879) which puts the variables into a hidden HTML table so they can be processed.

`sendMessage()` then calls [condense()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L1033) which removes duplicates from the table that have the same title but different races, genders, and percentiles. It saves the different race, gender, and percentile options for each variable to lists. For example, if kfr_black_pooled_p50 and kfr_black_pooled_p25 are both in the data, only one will be kept.

`sendMessage()` then calls [chooseDropdown()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L919) which makes sure that the race, gender, and percentile values for each variable are in line with the fields filled out by `/formulateQueryOrRespond`. For example, if `condense()` took in hs_pooled_pooled_mean, hs_male_pooled_mean, and hs_female_pooled_mean and removed both hs_male_pooled_mean and hs_female_pooled_mean but `/formulateQueryOrRespond` specified that the user wants the data for females only, `chooseDropdown()` will replace hs_pooled_pooled_mean with hs_female_pooled_mean.

`sendMessage()` then calls [linkRows()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L104) which reorders the tables so "families" are together (or "linked"). For example, if kfr_pooled_pooled_mean and kfr_pooled_pooled_p50 are both in the table but are not next to each other, then `linkRows()` will move the one farther from the top of the table to be next to the other. `linkRows()` also adds text to the descriptions of variables ending in "_n", "_se", "_p50", and "_p25" to make sure the chat understands what these variables mean. This additional text is not visible to the user. Finally, the function returns a string listing the top 10 variables and their descriptions in the table. The value of 10 can easily be changed. When this number is larger, the next step is better at choosing the right variable but costs more.

### Pick Final Variable From Resulting List

The next function called by `sendMessage()` is [pickVarAndDescribe()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L1214). This function calls [/pickVarAndDescribe](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L631) in the server which uses a function call from the OpenAI API to decide which of the variables returned by `linkRows()` to use. Along with its choice, the function call also returns a description of the variable. 

If the function call does not find a suitable variable, back in `pickVarAndDescribe()` the chat will print an error message to let the user know no variable was found. If a variable was found and no location was specified by the user, the chat displays the resulting variable along with its description. 

### All US Counties, County, Counties in State, Commuting Zone, Tracts in State, Address (Census Tract)

If a location was specified by the user then `sendMessage()` calls [getLocationData()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L1388). This function takes different actions depending on what type of location was requested. This description follows the branch of the flow chart where the user requested data for "All US Counties".

In this case, `getLocationData()` calls [fetchDataLoc()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L1487) which calls [/getData](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L596) in the server which finds the correct data and returns it to the front end along with its units. The returned data is a table consisting of the variable the function call decided was best along with the label columns, which in this case would include the county id and the county name. The data can be fetched quickly because each variable or label column is stored in its own sheet named according to the header of the column. `getLocationData()` then adds the resulting data to the chat while keeping it hidden.

### Describe Data

Finally, after the data is fetched, `sendMessage()` calls [describeLocationData()](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/static/js/script.js#L1340) which then calls [/describeLocationData](https://github.com/xamxl/Atlas-Chat/blob/main/Flask/main.py#L588) in the server. `/describeLocationData` uses a direct request, instead of a function call, to ask the OpenAI API to describe the data. The server then returns the description to the front end which displays the variable, location-specific data, and description to the user.

## Problems & Possible Next Steps

This section outlines some of the key problems with the chat and ways that these problems could be fixed.

Sometimes when the variable the user wants is not one of the top 10 variables returned by `linkRows()` the function call in `/pickVarAndDescribe` still returns the name of the variable that the user wants. Right now this causes the chat to break because the code can't find the variable from the function call in the list of possible variables. This could be fixed by making the chat directly search for variable names that are returned by the function call in `/pickVarAndDescribe` but are not in the list of possible variables created by `linkRows()`. If "Pick Final Variable From Resulting List" fails after the function call in `/pickVarAndDescribe` returns a variable name, then the chat should first try finding that variable directly from the database before returning an error.

To save money, the function call in `/useCase` used to only get one message to use when deciding which action to take. Since it was missing most of the context of the chat, the function call sometimes decided to take the wrong action. Recently, this was updated to four messages because the OpenAI API got much cheaper, so it made sense to give `/useCase` more messages to use when deciding which action to take. If this problem persists, it might be a good idea to add even more messages to the function call. Another option is to use a cheaper model like gpt-3.5 or gpt-4o-mini for this task and give the function call all of the messages.

If a user knows how to use the chat then generally they should be able to find what they are looking for. However, if someone is not familiar with the chat's workflow, then trying to get data, calculate statistics, or make figures can be confusing. For example, they may not know that to make a map they first have to request a variable for a specific location and then ask for the map to be created. To fix this, more explanatory text could be added to the chat's error messages and to the prompts given to chat-GPT. Another way to fix this would be to improve the workflow so that the chat can do two tasks following one prompt. For example, the chat could be able to first get the data and then create the map without the user having to break the task down into two prompts.

During a testing session with people form the lab, a number of OI members asked for the same three features:
1. The ability for the chat to manipulate data in more ways. For example, people wanted to be able to be able to get the rows of tables with the biggest or smallest values and to get the difference between two tables. While these features could be added to the chat individually, a better solution would be to give the chat the ability to write and execute python code on tables so that it could complete any task, even ones it was not preprogrammed to do.
2. The ability to understand more about how the data was calculated and what data is available. To do this the chat could be given the ability to search through the Atlas Paper with an embedding search engine to find relevant information to add to its context.
3. The ability to fetch multiple variables simultaneously with one request.

New embedding models and LLMs that outperform the ones used in this code are regularly being released. Researching the best LLMs and embedding models and replacing the models currently being used with the new ones will improve the chat. Try looking for chat-GPT 5 and for [llama 3.1 405B hosted by Groq](https://console.groq.com/docs/models).

## Contact

- [GitHub](https://github.com/xamxl)
- [Email](mailto:maxlaibson@gmail.com)

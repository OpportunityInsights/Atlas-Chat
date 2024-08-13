// Sets a variable to represent the mode of the chat: "Learner", "Normal", or "Expert"
let chatbotMode = '';

// Gets variables referring to the message input
const messageInput = document.getElementById('message-input');

// Makes lists of the options for different fields within variables
const race = ["white", "black", "hisp", "asian", "natam", "other", "pooled"];
const gender = ["male", "female", "pooled"];
const percentile = ["p1", "p25", "p10", "p50", "p75", "p100"];

// Creates a list of all the options above
const all = [...race, ...gender, ...percentile];
// Creates a list of all addons that denote different statistics calculated for each variable
const addOns = ["n", "mean", "se", "s", "imp", "mean_se"];

// A list to hold all the messages for the chatbot
// Starts with some generic instructions
let messages = [{
    role: 'assistant',
    content: "Only I have the ability to browse the database and provide data. You, the user, does not have the ability to use it or provide data. I will NEVER use equation formatting because this application can not parse it. I promise to use varying emojis and formatting VERY OFTEN. Data is only available for commuting zones, addresses (census tracts), counties, counties by state, all US counties, and census tracts by state. If you are given data, never use specific numeric examples or refer to specific locations, just talk about the variable names. Also, you have the ability to make scatter plots, calculate statistics, and make maps. To do these things, the user first has to ask for location specific data. After they do this, in their next message, they can then ask for a map, scatter, or statistic."
}];

// A list to hold all the variables that the chatbot returns
let variables = [];
// A list to hold the names of the locations that each variable in variable was found for (always the same length as variable)
let locations = [];
// A variable to count the number of variables added to variables each time a set of additions is made
let addedToVariables = 0;

// A list that contains all the variable names in the order that they were returned from the server after a data fetch
// It is reset every time new data is requested
// The names are added before the dropdowns are selected
let variableNamesFromServer = [];

// A dictionary where each key is the id of a table with the t removed form the beginning
// Each value is a list where the first element is the location name and the second element is the location type
let storedVariables = {};

// A list where each element in the html of a table that holds a variable
let tables = [];

// The values specified by a function call for the variable the user is currently looking for
let genderQ;
let raceQ;
let percentileQ;
let queryQ;
let locationTypeQ;
let locationNameQ;

// True if the table with the description should be displayed with the data, false otherwise
let displayVariableDescriptionTable = true;

// Adds the first message to the chat
appendMessage('error topMessage', "Hello! I'm a bot designed to help you find data! Please ask me anything and I will do my best to find some related data from the Opportunity Atlas paper.");
messages.push({ role: 'assistant', content: "Hello! I'm a bot designed to help you find data! Please ask me anything and I will do my best to find some related data from the Opportunity Atlas paper." });

// Adds an event listener to the input field to detect when the user presses enter and sends the message
messageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

// Adds an event listener to the shopping cart button which opens the data download page
document.getElementsByClassName("cart-button")[0].addEventListener("click", function() {
    // Stores all the tables that will be displayed on the data download page
    tables = [];

    // Capture tables to be displayed on the data download page and adds them to tables
    document.querySelectorAll('table').forEach(table => {
        // Checks that the table is not hidden and is not a table holding actual data
        if (!table.classList.contains('hidden') && !table.closest('div.hidden') && table.rows[0].cells.length === 2) {
                // Clone the table element to avoid modifying the original table
                let clonedTable = table.cloneNode(true);

                // Extract the title from the first cell
                let firstCellAnchor = clonedTable.querySelector('td a');
                let title = firstCellAnchor.href;

                // Creates the links for different geographical download levels
                let links = [
                         `<input type="checkbox"> Download Census Tract Data</input><br><br>`,
                         `<input type="checkbox"> Download County Data</input>`,
                         `<br><br><input type="checkbox"> Download Commuting Zone Data</input>`
                ];

                // Remove "Download Census Tract Data" link if the title contains "in5Not4"
                // If the title contains in5Not4 that means that the data is not available at the census tract level
                if (title.includes('in5Not4')) {
                    links.shift();
                }

                // Add the links as a new column for the current table
                let row = clonedTable.querySelector('tr');
                row.innerHTML += "<td>" + links.map(link => `${link}`).join('') + "</td>";

                // Find all select elements in the cloned table
                let selectElements = clonedTable.querySelectorAll('select');

                // Convert each select element to a multi-select
                selectElements.forEach(select => {
                    select.multiple = true;
                    select.disabled = false;
                    select.onclick = "";
                    select.classList.remove('notDropDown');
                });

                // Push the modified table HTML to the tables array
                tables.push({ html: clonedTable.outerHTML});
        }
    });

    // Hides the current chat
    document.getElementsByClassName("chat-container")[0].classList.toggle("hidden");

    // Create and append a div to the body
    let div = document.createElement('div');
    div.id = "shopping-cart-div";
    document.body.appendChild(div);
    div1 = document.createElement('div');
    div1.id = "scdi";
    div.appendChild(div1);
    div = div1;

    // Creates a link to close the data download page and display the chat again
    let a = document.createElement('a');
    function close() {
        document.getElementsByClassName("chat-container")[0].classList.toggle("hidden");
        document.getElementById("shopping-cart-div").remove();
    }
    a.innerHTML = '< Return to Chat';
    a.href = "#";

    // Adds the link as a message to the data download page, then adds the event listener to close the page
    appendMessageSCDI('message error topMessage', a.outerHTML + " " + '<a href="#" onclick="downloadAll(event)" class="download-link"><img height="1em" width="1em" src="' + downloadIconUrl + '" alt="Download"> Click here to download all selected data</a>');
    div.getElementsByTagName('a')[0].addEventListener('click', close);

    // Checks to see if there are any variable tables to add
    if (tables.length != 0) {
        // Adds a title for the tables
        let categoryTitle = document.createElement('h2');
        categoryTitle.innerHTML = "Variable Tables";
        appendMessageSCDI('message error des', categoryTitle.outerHTML);

        // Creates a table to hold all the tables once they are combined into one table
        let combinedTable = document.createElement('table');
        combinedTable.classList.add('table');
        combinedTable.classList.add('table-bordered');

        // Loops through each table
        tables.forEach((item) => {
            // Create a temporary container to parse and re-insert the HTML
            let tempDiv = document.createElement('div');
            tempDiv.id = "tempDiv";
            tempDiv.innerHTML = item.html;

            // Get the text from the 2nd column of the table's first row
            let secondColumn = tempDiv.querySelector('table tr td:nth-child(2)');

            // Parse and replace the text so the variable name is removed and only the generic description is shown
            let updatedText = secondColumn.innerText.replace(/^VARIABLE NAME: [^:]* - VARIABLE DESCRIPTION:/, 'VARIABLE DESCRIPTION:');

            // Update the text in the 2nd column
            tempDiv.querySelector('table tr td:nth-child(2)').innerText = updatedText;

            // Append the row to the combined table
            let row = tempDiv.querySelector('tr');
            if (row) {
                combinedTable.appendChild(row);
            }
        });

        // Append the combined table to the DOM
        appendMessageSCDI('message bot', combinedTable.outerHTML);
    };
});

// When the window first loads open the welcome popup
window.onload = function() {
    document.getElementById('popup').style.display = 'flex';
}

// This function deals with the error flagging feature
(function() {
    // Variables storing references to different ways that stuff enters the console
    var originalLog = console.log;
    var originalError = console.error;
    var originalWarn = console.warn;

    // Content of the console to be send with the error
    var consoleContent = "";

    // Overwrite the console.log function to store the content and then log it
    console.log = function(message) {
        try {
            consoleContent += message + "\n";
        } catch (e) {
            alert("Additional debugging data will not be logged.")
        }
        originalLog.apply(console, arguments);
    };

    // Overwrite the console.error function to store the content and then log it
    console.error = function(message) {
        consoleContent += message + "\n";
        originalError.apply(console, arguments);
    };

    // Overwrite the console.warn function to store the content and then log it
    console.warn = function(message) {
        consoleContent += message + "\n";
        originalWarn.apply(console, arguments);
    };

    // Function to send data to the server
    async function sendData(data) {
        
        const response = await fetch('http://127.0.0.1:3000/save_report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({data})
        });
        return response.json();
    }

    // Function to capture HTML content
    function getHTMLContent() {
        return document.documentElement.outerHTML;
    }

    // Function to gather and send data
    async function gatherAndSendData() {
        // Gets the data
        const htmlContent = getHTMLContent();
        const comment = document.getElementsByTagName('textarea')[0].value;
        const data = {
            html: htmlContent,
            console: consoleContent,
            comment: comment
        };

        // Disables the buttons and changes the text in the error flagging area
        document.getElementById("rb1").disabled = true;
        document.getElementById("rb2").disabled = true;
        document.getElementById("rb1").classList.add('disabled');
        document.getElementById("rb2").classList.add('disabled');
        document.getElementById("rt").innerHTML = 'Saving your report <span class="animate-ellipsis"></span>';

        // Sends the data to the server
        await sendData(data);

        // Reverses the changes to the error flagging area and hides it
        document.getElementById("rb1").disabled = false;
        document.getElementById("rb2").disabled = false;
        document.getElementById("rb1").classList.remove('disabled');
        document.getElementById("rb2").classList.remove('disabled');
        document.getElementById("rt").innerHTML = 'The chat contents will be sent with any comments you leave here.';
        document.getElementById('report-popup').classList.add('hidden');
    }

    // Expose gatherAndSendData to global scope
    window.gatherAndSendData = gatherAndSendData;
})();

// Opens the report popup
function openReportPopup() {
    document.getElementById('report-popup').classList.remove('hidden');
    document.getElementsByTagName('textarea')[0].value = '';
}

// Closes the report popup
function closeReportPopup() {
    document.getElementById('report-popup').classList.add('hidden');
}

// Does some checks to see if an input string is a JSON string. If so, returns true, else false
function isValidJSON(str) {
    return typeof str === 'string' && str.trim().startsWith('{') && str.trim().endsWith('}');
}

// Takes in an object with a data table enclosed and downloads the data as a xlsx file
function downloadAsXLSX(data) {
    data = data.tableData;
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "table");
    XLSX.writeFile(wb, `table.xlsx`);
}

// Takes in an html string and removes all tables from it
// Prevents chat-GPT from trying to interpret the table as markdown with fake data
function removeTablesFromHtml(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const tables = doc.querySelectorAll('table');
    tables.forEach(table => table.remove());
    
    return doc.body.innerHTML;
}

// A function to check if two arrays are equal in length and values
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

// Takes in the name of a sheet and the name of a variable, fetches the related data, and downloads the related data using downloadAsXLSX
// Used for census tract level data
async function fetchCensusTractData(sheet, variable) {
    const data = await fetchDataLoc(variable, sheet);
    downloadAsXLSX(data);
}

// Takes in the name of a sheet and the name of a variable, fetches the related data, and downloads the related data using downloadAsXLSX
// If the sheet name is for census tracts, changes it to be for counties
// Used for county level data
async function fetchCountyData(sheet, variable) {
    let newSheet;

    if (sheet === "Neighborhood Characteristics by Census Tract") {
        newSheet = "Neighborhood Characteristics by County";
    } else if (sheet === "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender") {
        newSheet = "Household Income and Incarceration for Children from Low-Income Households by County, Race, and Gender";
    } else if (sheet === "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile") {
        newSheet = "All Outcomes by County, Race, Gender and Parental Income Percentile";
    } else {
        newSheet = sheet; // Default to the original sheet name if none match
    }

    const data = await fetchDataLoc(variable, newSheet);
    downloadAsXLSX(data);
}

// Takes in the name of a sheet and the name of a variable, fetches the related data, and downloads the related data using downloadAsXLSX
// If the sheet name is for census tracts, changes it to be for commuting zones
// Used for commuting zone level data
async function fetchCommutingZoneData(sheet, variable) {
    let newSheet;

    if (sheet === "in5Not4") {
        newSheet = "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile";
    } else if (sheet === "Neighborhood Characteristics by Census Tract") {
        newSheet = "Neighborhood Characteristics by Commuting Zone";
    } else if (sheet === "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile") {
        newSheet = "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile";
    } else if (sheet === "Household Income and Incarceration for Children from Low-Income Households by Census Tract") {
        newSheet = "Household Income and Incarceration for Children from Low-Income Households by Commuting Zone";
    }

    const data = await fetchDataLoc(variable, newSheet);
    downloadAsXLSX(data);
}

// Sets the mode of the chat based on the user selection
function selectMode(mode) {
    chatbotMode = mode;

    // Makes the popup to choose the mode disappear
    const popup = document.getElementById('popup');
    popup.classList.add('fade-out');
    // After the fade out of the popup is done, the popup is removed from the DOM
    setTimeout(() => {
        popup.style.display = 'none';
    }, 500); // Match this with the transition duration in the CSS

    // Replaces the message on the top of the screen with the right message for that mode
    removeLastMessage();
    appendMessage('error topMessage', "Hello! I'm a bot designed to help you find data! Please ask me anything and I will do my best to find some related data from the Opportunity Atlas paper. (" + chatbotMode + " Mode)");
    // Adds a message to messages to instruct the AI about its user
    if (chatbotMode == "Expert") {
        messages.push({ role: 'assistant', content: "I am talking with an expert. I will assume they understand economics and statistics and are a very serious person who does not like emojis. I am their helpful assistant. I WILL USE THIS IN EVERYTHING I WRITE AND DO, EVEN IN FUNCTION CALLS."});
    } else if (chatbotMode == "Learner") {
        messages.push({ role: 'assistant', content: "I am talking to a person who has the knowledge of a 2nd grader. I will assume they know nothing about economics and statistics, and I will be their teacher. I WILL USE THIS IN EVERYTHING I WRITE AND DO, EVEN IN FUNCTION CALLS."});
    }
}

// Appends a message to the chat
// Takes in a list of classes for the message and the message
function appendMessage(sender, message) {
    const chatBox = document.getElementById('chat-box');
    // Removes the two br messages at the bottom of the chat
    removeBR();
    removeBR();
    // Formats the message using markdown
    let formattedMessage = message;
    if (sender.split(' ').includes('error')) {
        formattedMessage = marked.parse(message);
        formattedMessage = removeTablesFromHtml(formattedMessage);
    }
    // Creates the message div and adds it to the chat
    const messageElement = document.createElement('div');
    messageElement.classList.add('message')
    sender.split(' ').forEach(className => messageElement.classList.add(className));
    messageElement.innerHTML = formattedMessage;
    chatBox.appendChild(messageElement);
    // Adds two br messages to the bottom of the chat
    let br = document.createElement('br');
    chatBox.appendChild(br);
    br = document.createElement('br');
    chatBox.appendChild(br);
}

// Adds a message to the shopping cart
// Takes in a list of classes for the message and the message
function appendMessageSCDI(sender, message) {
    // Formats the mates
    let formattedMessage = message;
    if (sender.split(' ').includes('error')) {
        formattedMessage = marked.parse(message);
        formattedMessage = removeTablesFromHtml(formattedMessage);
    }
    // Creates the message div and adds it to the shopping cart
    const messageElement = document.createElement('div');
    messageElement.classList.add('message')
    sender.split(' ').forEach(className => messageElement.classList.add(className));
    messageElement.innerHTML = formattedMessage;
    document.getElementById("scdi").appendChild(messageElement);
}

// Removes the last br from the chat
function removeBR() {
    const brs = document.querySelectorAll('br');
    if (brs.length > 0) {
        brs[brs.length - 1].remove();
    }
}

// Removes the last message from the chat
function removeLastMessage() {
    const messages = document.querySelectorAll('.message');
    if (messages.length > 0) {
        messages[messages.length - 1].remove();
    }
}

// Prevents certain links from working
function clickLink(event) {
    event.preventDefault();
}
  
// Gets the variable name and sheet name for the variable in the table
function extractLinkData(table) {
    const row = table.rows[0];
    if (!row) return null;
    const link = row.cells[0].querySelector('a');
    if (!link) return null;
    const url = new URL(link.href);
    const varParam = url.searchParams.get('var');
    const sheetParam = url.searchParams.get('sheet');
    return varParam ? { shortestVar: varParam, correspondingSheet: sheetParam } : null;
}

// Opens the graphing popup and populates it with the variables that can be graphed with the current variable
function openGraphPopup(event) {
    event.preventDefault();

    // Makes the popup visible
    const graphPopup = document.getElementById('graph-popup');
    graphPopup.classList.remove('hidden');

    // Gets the id related to the current variable
    let id = event.currentTarget.id;
    
    // Empties the options div
    const optionsDiv = document.querySelector('.graph.options');
    optionsDiv.innerHTML = '';

    let variableNames = [];
    // Populate variableNames from the stored data with the variable names and corresponding ids that can be graphed with the current variable
    for (let key in storedVariables) {
        if (storedVariables[key][0] == storedVariables[event.currentTarget.id][0] && storedVariables[key][1] == storedVariables[event.currentTarget.id][1] && key != event.currentTarget.id) {
            let table = document.getElementById("t" + key);
            let rows = table.rows;
            let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
            variableNames.push([variableName, key]);
        }
    }

    // Create a button for each variable that can be graphed with the current variable and adds it to options
    variableNames.forEach(variable => {
        const button = document.createElement('button');
        button.classList.add('mode-button');
        button.classList.add('graph-button');
        button.textContent = variable[0];
        button.onclick = () => graphVariable(variable, id);
        optionsDiv.appendChild(button);
    });
}

// Closes the graphing popup
function closeGraphPopup() {
    const graphPopup = document.getElementById('graph-popup');
    graphPopup.classList.add('hidden');
}

// Runs every time the user sends a message
// First figures out what the user wants to do
// Then  calls the function to execute that task
async function sendMessage() {
    // Gets the message and checks it is not empty
    const message = messageInput.value;
    if (message.trim() === '') return;

    // Adds the message to the chat and messages
    appendMessage('user', message);
    messages.push({ role: 'user', content: message });
    // Clears the input field
    messageInput.value = '';

    // Adds a placeholder message to the chat
    appendMessage('error', 'Thinking <span class="animate-ellipsis"></span>');

    // Checks what specific task the user wants and calls the related function
    let wTD = await useCase(message);
    if(wTD == "create scatter plot") {
        requestGraphVars();
        return
    } else if (wTD == "create map") {
        requestMapVars();
        return
    } else if (wTD == "calculate mean") {
        requestSingleStatVar('get mean');
        return
    } else if (wTD == "calculate median") {
        requestSingleStatVar('get median');
        return
    } else if (wTD == "calculate standard deviation") {
        requestSingleStatVar('get standard deviation');
        return
    } else if (wTD == "calculate correlation") {
        requestDoubleStatVars();
        return
    } else {
        // Prepares the parameters to search for a variable or directly answers the user's question
        if (! await variableSearch()) {return}
        // Gets a list of variables from the database
        let chatData = await fetchData();
        if (! chatData) {return}
        // Turns those variables into a table
        let randomID = makeTable(chatData);
        if (! randomID) {return}
        let table = document.getElementById(randomID);
        // Combines variables in the table with the same name but different characteristics like race, gender, or percentile
        condense(table);
        // Chooses the right race, gender, and percentile for each variable
        chooseDropdown(table);
        // linkRows: creates families of variables by linking things like kfr_black_pooled_p50 and kfr_black_pooled together
        // pickVarAndDescribe: picks a specific variable to display and writes a description for that variable
        // getLocationData: fetches the data for the location specific variable
        if (! pickVarAndDescribe(table, linkRows(table)) || ! getLocationData(table)) {return}
        // Writes a final description for the location specific data
        describeLocationData();
    }
}

// Prepares the parameters to search for a variable or directly answers the user's question
async function variableSearch() {
    try {
        // Asks chat-GPT to either answer the user's question or do a function call to get the data
        // Sends the messages to the server
        const response = await fetch('http://127.0.0.1:3000/formulateQueryOrRespond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });
        const data = await response.json();
        if (isValidJSON(data.reply)) {
            // If the function was called, gets the values of the parameters for the variable search
            // If the values are not there, sets defaults
            let pars = JSON.parse(data.reply);
            genderQ = pars["gender"] || "pooled";
            raceQ = pars["race"] || "pooled";
            percentileQ = pars["percentile"] || "p25";
            queryQ = pars["query"];
            // If the function call is missing a query, asks the user to try again and be more specific. Then returns
            if (!queryQ) {
                removeLastMessage();
                appendMessage('error', "Could you specify what data you're looking for? For example, you could say education, income, or parental.");
                messages.push({ role: 'assistant', content: "Could you specify what data you're looking for? For example, you could say education, income, or parental." });
                return false;
            }
            // Since state is not an option, if the location type is state, changes it to counties in state (default instead of census tracts in state)
            locationTypeQ = pars["location type"] === "state" ? "counties in state" : pars["location type"];
            // If the location type is all US counties, sets the location name to an empty string since this location has no name, just a type
            // Otherwise sets it to the name of the location
            locationNameQ = locationTypeQ === "all US counties" ? "" : pars["location name"];
        
            return true;
        } else {
            // If the function was not called, prints the answer to the users's question to the chat and adds it to messages
            // First removes placeholder message
            removeLastMessage();
            appendMessage('error', data.reply);
            messages.push({ role: 'assistant', content: data.reply });
            return false;
        }
    } catch (error) {
        // If there is an error, prints an error message to the chat and adds it to messages
        console.error('Error:', error);
        removeLastMessage();
        appendMessage('error', "Sorry, there was an error processing your request.");
        Array.from(document.getElementsByClassName('toDelete')).forEach(element => element.classList.add('hidden'));
        return false;
    }
}

// This functions picks a variable to calculate a statistic with and then runs the calculation
async function requestSingleStatVar(operation) {
    // Picks the variable
    const varsData = await requestVar("pickSingleStatVar");

    // If the reply is valid JSON, parses it and calculates the statistic
    // Otherwise prints the reply to the chat and adds it to messages
    if (isValidJSON(varsData.reply)) {
        let pars = JSON.parse(varsData.reply);

        // Gets the id of the table that has the chosen variable in it
        let varToStat = getVariableId(pars["variable"], pars["variableType"]);

        // If the variable is not found, prints an error message to the chat and adds it to messages
        if (varToStat == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble calculating that statistic.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"");
            messages.push({ role: 'assistant', content: "I'm having trouble calculating that statistic.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"" });
            return;
        }

        // Get the sheet with id t + varToMap and make its contents into a list of lists
        let table = document.getElementById("t" + varToStat);
        let rows = table.rows;
        let data = [];
        for (let i = 1; i < rows.length; i++) {
            let row = [];
            for (let j = 0; j < rows[i].cells.length; j++) {
                row.push(rows[i].cells[j].textContent);
            }
            data.push(row);
        }

        // Gets the last column of the table and filters out any non-numeric values
        let lastColumnData = data.map(row => parseFloat(row[row.length - 1])).filter(value => !isNaN(value));
        if (operation === 'get mean') {
            // Calculates mean, prints it to the chat, and adds it to messages
            let sum = lastColumnData.reduce((acc, val) => acc + val, 0);
            removeLastMessage();
            appendMessage('error', `The mean of ${pars["variable"]} is ${sum / lastColumnData.length}. This statistic is calculated by weighting all rows from the data table equally.`);
            messages.push({ role: 'assistant', content: `The mean of ${pars["variable"]} is ${sum / lastColumnData.length}. This statistic is calculated by weighting all rows from the data table equally.`});
          } else if (operation === 'get median') {
            // Calculates median, prints it to the chat, and adds it to messages
            lastColumnData.sort((a, b) => a - b);
            let middleIndex = Math.floor(lastColumnData.length / 2);
            if (lastColumnData.length % 2 === 0) {
              removeLastMessage();
              appendMessage('error', `The median of ${pars["variable"]} is ${(lastColumnData[middleIndex - 1] + lastColumnData[middleIndex]) / 2}. This statistic is calculated by weighting all rows from the data table equally.`);
              messages.push({ role: 'assistant', content: `The median of ${pars["variable"]} is ${(lastColumnData[middleIndex - 1] + lastColumnData[middleIndex]) / 2}. This statistic is calculated by weighting all rows from the data table equally.`});
            } else {
                removeLastMessage();
                appendMessage('error', `The median of the data is ${lastColumnData[middleIndex]}. This statistic is calculated by weighting all rows from the data table equally.`);
                messages.push({ role: 'assistant', content: `The median of the data is ${lastColumnData[middleIndex]}. This statistic is calculated by weighting all rows from the data table equally.` });
            }
          } else if (operation === 'get standard deviation') {
            // Calculates standard deviation, prints it to the chat, and adds it to messages
            let mean = lastColumnData.reduce((acc, val) => acc + val, 0) / lastColumnData.length;
            let variance = lastColumnData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / lastColumnData.length;
            removeLastMessage();
            appendMessage('error', `The standard deviation of ${pars["variable"]} is ${Math.sqrt(variance)}. This statistic is calculated by weighting all rows from the data table equally.`);
            messages.push({ role: 'assistant', content: `The standard deviation of ${pars["variable"]} is ${Math.sqrt(variance)}. This statistic is calculated by weighting all rows from the data table equally.` });
          }
    } else {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
    }
}

// This functions picks two variables to calculate a statistic with and then runs the calculation
async function requestDoubleStatVars() {
    // Picks the variables
    const varsData = await requestVar("pickDoubleStatVars");
    
    // If the reply is valid JSON, parses it and calculates the statistic
    // Otherwise prints the reply to the chat and adds it to messages
    if (isValidJSON(varsData.reply)) {
        let pars = JSON.parse(varsData.reply);

        // Gets the ids of the tables that have the chosen variables in them
        let varToStat1 = getVariableId(pars["variable1"], pars["variableType1"]);
        let varToStat2 = getVariableId(pars["variable2"], pars["variableType2"]);

        // If the variables are not found, prints an error message to the chat and adds it to messages
        if (varToStat1 == null || varToStat2 == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble calculating that statistic.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"");
            messages.push({ role: 'assistant', content: "I'm having trouble calculating that statistic.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"" });
            return;
        }

        // Get the sheets with ids t + varToMap and make their contents into lists of lists
        let table1 = document.getElementById("t" + varToStat1);
        let rows1 = table1.rows;
        let data1 = [];
        for (let i = 1; i < rows1.length; i++) {
            let row = [];
            for (let j = 0; j < rows1[i].cells.length; j++) {
                row.push(rows1[i].cells[j].textContent);
            }
            data1.push(row);
        }
        let table2 = document.getElementById("t" + varToStat2);
        let rows2 = table2.rows;
        let data2 = [];
        for (let i = 1; i < rows2.length; i++) {
            let row = [];
            for (let j = 0; j < rows2[i].cells.length; j++) {
                row.push(rows2[i].cells[j].textContent);
            }
            data2.push(row);
        }

        // Get the last columns of the tables and filter out any non-numeric values
        let lastColumnData1 = data1.map(row => parseFloat(row[row.length - 1]));
        let lastColumnData2 = data2.map(row => parseFloat(row[row.length - 1]));
        let filteredData1 = [];
        let filteredData2 = [];
        for (let i = 0; i < lastColumnData1.length; i++) {
            if (!isNaN(lastColumnData1[i]) && !isNaN(lastColumnData2[i])) {
                filteredData1.push(lastColumnData1[i]);
                filteredData2.push(lastColumnData2[i]);
            }
        }
        lastColumnData1 = filteredData1;
        lastColumnData2 = filteredData2;

        // Calculates mean
        let mean1 = lastColumnData1.reduce((acc, val) => acc + val, 0) / lastColumnData1.length;
        let mean2 = lastColumnData2.reduce((acc, val) => acc + val, 0) / lastColumnData2.length;

        // Calculates the correlation, adds it to the chat, and adds it to messages
        let numerator = lastColumnData1.reduce((acc, val, idx) => acc + ((val - mean1) * (lastColumnData2[idx] - mean2)), 0);
        let denominator1 = Math.sqrt(lastColumnData1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0));
        let denominator2 = Math.sqrt(lastColumnData2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0));
        removeLastMessage();
        appendMessage('error', `The correlation between ${pars["variable1"]} and ${pars["variable2"]} is ${numerator / (denominator1 * denominator2)}. This statistic is calculated by weighting all rows from the data tables equally.`);
        messages.push({ role: 'assistant', content: `The correlation between ${pars["variable1"]} and ${pars["variable2"]} is ${numerator / (denominator1 * denominator2)}. This statistic is calculated by weighting all rows from the data tables equally.` });
    } else {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
    }
}

// This functions picks a variable to make a map with and then creates that map
async function requestMapVars() {
    // Picks the variable
    const varsData = await requestVar("pickMapVars");

    // If the reply is valid JSON, parses it and makes the map
    // Otherwise prints the reply to the chat and adds it to messages
    if (isValidJSON(varsData.reply)) {
        let pars = JSON.parse(varsData.reply);

        // Cleans the variable type so it can easily be displayed later
        const result = pars["variableType"].replace(' in state', '');
        if (result == "the ful US all US counties") {
            result = "all US counties";
        }

        // Gets the id of the table that has the chosen variable in it
        let varToMap = getVariableId(pars["variable"], pars["variableType"]);

        // If the variable is not found, prints an error message to the chat and adds it to messages
        if (varToMap == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble making that map.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"");
            messages.push({ role: 'assistant', content: "I'm having trouble making that map.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"" });
            return;
        }

        // Removes a placeholder message and adds a new one
        removeLastMessage();
        appendMessage('error toDelete', 'Making your map <span class="animate-ellipsis"></span>');

        // Get the sheet with id t + varToMap and make its contents into a list of lists
        let table = document.getElementById("t" + varToMap);
        let rows = table.rows;
        let data = [];
        for (let i = 1; i < rows.length; i++) {
            let row = [];
            for (let j = 0; j < rows[i].cells.length; j++) {
                row.push(rows[i].cells[j].textContent);
            }
            data.push(row);
        }

        // Figures out what type of map, county or census tract, to make
        let cOT = "county";
        if (table.rows[0].cells[4].textContent == "tract") {
            cOT = "tract";
        }

        // Set up timeout for the fetch
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 600000); // 60 seconds timeout

        // Creates a div to hold the map html
        let d = document.createElement('div');
        let randomNum = Math.floor(Math.random() * 1000000);
        d.id = 'md' + randomNum;
        d.style.display = 'none';
        d.style.width = '100%';

        // Sets the data to the server and gets a map back in return (the map is an html string)
        fetch('http://127.0.0.1:3000/generate_map', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ table: data, geo_level: cOT }),
            signal: controller2.signal
        })
        .then(response => {
            clearTimeout(timeoutId2);
            return response.json();
        })
        .then(data => {
            // Removes the placeholder message
            removeLastMessage();

            // If the map was successfully generated adds the map to the div and makes it visible
            // Otherwise sends an error
            if (data.html) {
                // Adds a header message for the map
                appendMessage('error', `Here is your map of ${pars["variable"]} for ${result}. <a href="#" id="${'li' + randomNum}" onclick="captureElementM(event)" class="download-link"><img height="1em" width="1em" src="${downloadIconUrl}" alt="Download"> Click here to download</a>`);
                messages.push({ role: 'assistant', content: `Here is your map of ${pars["variable"]} for ${result}.` });
                // Adds the div to the chat
                appendMessage('error graph', d.outerHTML);
                // Adds the map to the div and makes it visible
                document.getElementById('md' + randomNum).innerHTML = data.html;
                document.getElementById('md' + randomNum).style.display = 'block';
            } else {
                appendMessage('error', "I'm sorry, their was an error generating your map of " + pars["variable"] + " for " + result + ".");
                messages.push({ role: 'assistant', content: "I'm sorry, their was an error generating your map of " + pars["variable"] + " for " + result + "." });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while generating the map.');
        });

        messages.push({ role: 'assistant', content: "Map created!" });
    } else {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
    }
}

// This functions picks two variables to make a scatter plot with and then creates that figure
async function requestGraphVars() {
    // Picks the variables
    const varsData = await requestVar("pickGraphVars");

    // If the reply is valid JSON, parses it and makes the plot
    // Otherwise prints the reply to the chat and adds it to messages
    if (isValidJSON(varsData.reply)) {
        let pars = JSON.parse(varsData.reply);

        // Gets the ids of the tables that have the chosen variables in them
        let xKey = getVariableId(pars["x"], pars["xType"]);
        let yKey = getVariableId(pars["y"], pars["yType"]);

        // Cleans the variable type so it can easily be displayed later
        const result = pars["xType"].replace(' in state', '');

        // If the variables are not found, prints an error message to the chat and adds it to messages
        if (xKey == null || yKey == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble making that plot.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"");
            messages.push({ role: 'assistant', content: "I'm having trouble making that plot.\n\nI can only work with data that we have already pulled from the database. This means that if you want to make a map, calculate a statistic, or graph, you first have to ask me something like \"Get me median income for all counties in Texas.\"" });
            return;
        }

        // Removes a placeholder message
        removeLastMessage();

        // Adds a header message for the graph
        appendMessage('error', `Here is your graph of ${pars["x"]} and ${pars["y"]} for ${result}. <a href="#" onclick="captureElement(event)" class="download-link"><img height="1em" width="1em" src="${downloadIconUrl}" alt="Download"> Click here to download</a>`);
        messages.push({ role: 'assistant', content: `Here is your graph of ${pars["x"]} and ${pars["y"]} for ${result}.` });
        // Makes the graph
        graphVariable([pars["y"], yKey], xKey);
        // Since the chatbot can not see the graph, gives it a message to show that the graph was created
        messages.push({ role: 'assistant', content: "Graph created!" });
    } else {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
    }
}

// Calls a server endpoint to pick a variable or set of variables for a certain task like graphing, mapping, or statistic creation
async function requestVar(endPoint) {
    let longString = "";

    // Populate populates longString with all the variables that could be used to calculate the statistic
    // Includes the location name and type with each variable name
    for (let key in storedVariables) {
        let table = document.getElementById("t" + key);
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let variableType = `${storedVariables[key][0]} ${storedVariables[key][1]}`;
                longString += `VARIABLE NAME: ${variableName} VARIABLE TYPE: ${variableType} `;
            }
        }
    }

    // Make a copy of messages and adds the longString to it under the tag "PROVIDED VARIABLES:"
    mgs = [...messages];
    if (longString === "") {
        longString = "None";
    }
    mgs.push({ role: 'user', content: "PROVIDED VARIABLES: " + longString});

    // Calls the server to have chat-GPT pick one of the variable to use
    const vars = await fetch('http://127.0.0.1:3000/' + endPoint, {   
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "messages": mgs }),
    });
    const varsData = await vars.json();

    return varsData;
}

// Takes in variable name and type and returns the id of the table which has that variable in it minus the t
function getVariableId(variableName, variableType) {
    // Searches through each item in storedVariables
    for (let key in storedVariables) {
        // Gets the table relating to that element
        let table = document.getElementById("t" + key);
        // If that table corresponds to the variable name and type, returns the id of the table without the t
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let currentVariableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let currentVariableType = `${storedVariables[key][0]} ${storedVariables[key][1]}`;
                // if the last character of the type is a space, remove it
                if (currentVariableType[currentVariableType.length - 1] === ' ') {
                    currentVariableType = currentVariableType.substring(0, currentVariableType.length - 1);
                }
                // also does it for the front
                if (currentVariableType[0] === ' ') {
                    currentVariableType = currentVariableType.substring(1, currentVariableType.length);
                }
                
                if (currentVariableName === variableName && currentVariableType === variableType) {
                    return key;
                }
            }
        }
    }
    return null; // Return null if no match is found
}

// Takes in a single message and asks chat-GPT to use it to figure out what action the user wants that chatbot to take
async function useCase(message) {
    mgs = [{ role: 'user', content: message }];
    const gQM = await fetch('http://127.0.0.1:3000/useCase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "message": mgs }),
        });
    const decision = await gQM.json();
    return JSON.parse(decision.reply).action;
}

// Continues the process of fetching a variable by calling the server with the prompt
// Returns a list of all variables ordered by relevance
async function fetchData() {
    try {
        // Calls the server to get the list of variables
        const chatResponse = await fetch('http://127.0.0.1:3000/getRankedVariables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "message": queryQ }),
        });
        const chatData = await chatResponse.json();

        // If no variables were found that were sufficiently close to the query, prints an error message to the chat and adds it to messages
        if (chatData.reply[0] === "NO") {
            removeLastMessage();
            appendMessage('error', "Hmm. I don't think we have any data on that.");
            messages.push({ role: 'assistant', content: "Hmm. I don't think we have any data on that." });
            return false;
        }

        return chatData;
    } catch (error) {
        console.error('Error:', error);
        removeLastMessage();
        appendMessage('error', "Sorry, there was an error processing your request.");
        // Removes any residual placeholder messages
        Array.from(document.getElementsByClassName('toDelete')).forEach(element => element.classList.add('hidden'));
        return false;
    }
}

// Puts the processed variable list from the server into a table and returns the id of that table
function makeTable(data) {
    // Updates the placeholder message
    removeLastMessage();
    appendMessage('error toDelete', 'Processing your data <span class="animate-ellipsis"></span>');
    setTimeout(() => { }, 20);

    // If the data is not valid, prints an error message to the chat and adds it to messages
    if (data.reply === "ERROR") {
        removeLastMessage();
        appendMessage('error', "Sorry, there was an error processing your request.");
        Array.from(document.getElementsByClassName('toDelete')).forEach(element => element.classList.add('hidden'));
        return false;
    }

    // Creates a table as an html string and puts the data into it
    let randomID = Math.floor(Math.random() * 1000000);
    let tableHtml = '<table class="table table-bordered main" id="' + randomID + '">';
    data.reply.forEach(row => {
        let cells = row.split("SPECIAL").map((cell, index) => {
            if (index === 0) {
                let [sheet, varName] = cell.split("LINK");
                return `<td><a href="http://127.0.0.1:3000/viewData?sheet=${sheet}&var=${varName}" disabled onclick="clickLink(event)" class="broken" target="_blank">${varName}</a></td>`;
            } else {
                return `<td>${cell}</td>`;
            }
        }).join('');
        tableHtml += `<tr>${cells}</tr>`;
    });
    tableHtml += "</table>";

    // Adds the data to the chat as a hidden table
    appendMessage('error hidden showLatter', 'Here is the data I got from the database.');
    messages.push({ role: 'assistant', content: "Here is some data that may help. Give me a second to write up an explanation." });
    appendMessage('bot showLatter hidden', tableHtml);

    return randomID;
}

// Takes the values, for example kfr_black_pooled_p50, and changes their values to align with what the user wants
// For example, if they wanted it for female white people in p50, it would change kfr_black_pooled_p50 to kfr_white_female_p50
function chooseDropdown(table) {
    // Get all select elements in the table
    const dropdowns = table.querySelectorAll('select');

    // Function to update a select if it contains the target value
    function updateDropdownIfMatch(dropdown, targetValue) {
        const option = Array.from(dropdown.options).find(opt => opt.value == targetValue);
        if (option) {
            dropdown.value = targetValue;
            dropdown.dispatchEvent(new Event('change'));
            return true;
        }
        return false;
    }
    
    // Iterate through all select elements in the table
    dropdowns.forEach(dropdown => {
        // Initialize a flag to track if the dropdown has been updated
        let isUpdated = false;
    
        // Check and update dropdown with raceQ if not already updated
        if (!isUpdated && updateDropdownIfMatch(dropdown, raceQ)) {
            isUpdated = dropdown.value != "pooled";
        }
    
        // Check and update dropdown with genderQ if not already updated
        if (!isUpdated && updateDropdownIfMatch(dropdown, genderQ)) {
            isUpdated = dropdown.value != "pooled";
        }
    
        // Check and update dropdown with percentileQ if not already updated
        if (!isUpdated) {
            updateDropdownIfMatch(dropdown, percentileQ);
        }
    });

    // Hides elements marked for deletion
    Array.from(document.getElementsByClassName('toDelete')).forEach(element => element.classList.add('hidden'));
}

// Processes the data by removing duplicates of the same title for different races, genders, and percentiles
// For example, if kfr_black_pooled_p50 and kfr_black_pooled_p25 are both in the data, only one will be kept
// Saves the options for different races, genders, and percentiles for each variable
function condense(table) {
    // Empties variableNamesFromServer
    variableNamesFromServer = [];
    // Temporal list to store the links corresponding to the titles
    let links = [];
    // Gets all the rows in the table
    const rows = Array.from(table.querySelectorAll('tr'));
    // For each row, adds the title to variableNamesFromServer and the link to links
    rows.forEach(row => {
        const link = row.querySelector('td:nth-child(1) a');
        variableNamesFromServer.push(link.textContent.split("_"));
        links.push(link.href);
    });

    // Makes a list like variableNamesFromServer but with all race, gender, and percentile information replaced with empty strings
    let titles1 = variableNamesFromServer.map(title => title.map(part => (all.includes(part) ? '' : part)));

    // Goes through each of these new titles
    for (let i = 0; i < titles1.length; i++) {
        // Creates an array filled the as many empty arrays as there are parts in the title
        let options = Array(titles1[i].length).fill([]).map(() => []);
        // Creates an array to store the links and titles that are the same as the current title
        let lin = [];
        let ti = [];
        // Loops through each title appearing after the current title (also including the current title)
        for (let j = i; j < titles1.length; j++) {
            // If the current title is the same as the title being compared to (not considering race, gender, or percentile)
            // Adds to the arrays in options all the options for race, gender, and percentile
            // Stores in lin and ti the links and titles that correspond to those options
            if (arraysEqual(titles1[i], titles1[j])) {
                let added = false;
                titles1[i].forEach((_, k) => {
                    if (titles1[i][k] === '') {
                        added = true;
                        options[k].push(variableNamesFromServer[j][k]);
                    }
                });
                if (added) {
                    lin.push(links[j]);
                    ti.push(variableNamesFromServer[j]);
                }

                // Removes the row from the table if it is not the current row
                if (j != i) {
                    titles1.splice(j, 1);
                    variableNamesFromServer.splice(j, 1);
                    links.splice(j, 1);

                    rows[j].remove();
                    rows.splice(j, 1);
                    j--;
                }
            }
        }
        // Remakes the row in the table corresponding to the current title by adding drop downs with all the options
        remakeLink(rows[i].querySelector('td:nth-child(1) a'), lin, ti, options);
    }
}

// Reorders the table by putting all similar values together
// For example, if kfr_black_pooled_p50 and kfr_black_pooled are both in the dataset but are not next to each other, moves them to be next to each other
// Then returns the top 10 variables as text
function linkRows(table) {
    // Sets the number of variable added to variables to be 0 and defaults displayVariableDescriptionTable to true
    addedToVariables = 0;
    displayVariableDescriptionTable = true;
    // Gets all the rows in the table and removes all race, percentile, gender, and statistical information from the titles
    // Rejoins the titles into strings
    let titlesTogether = variableNamesFromServer.map(title => title.filter(part => !addOns.includes(part) && !all.includes(part)).join('_'));
    // Initializes a list to store the indexes of the rows that are linked together
    let linkedRows = [];

    // Gets all the rows
    const rows = Array.from(table.querySelectorAll('tr'));
    // Loops through all the rows
    // Makes linkedRows into a list of lists where each list contains the indexes of the rows that are linked together
    // Meaning their titlesTogether values are the same
    // These lists of lists are still ordered by relevance
    for (let i = 0; i < rows.length; i++) {
        if (linkedRows.some(list => list.includes(i))) continue;
        linkedRows.push([i]);

        for (let j = i + 1; j < rows.length; j++) {
            if (titlesTogether[i] == titlesTogether[j]) {
                linkedRows[linkedRows.length - 1].push(j);
            }
        }
    }

    // Makes strings out of the titles without race, percentile, gender, and statistical information removed
    let tableTitles = variableNamesFromServer.map(title => title.join('_'));
    // Gets a list of the descriptions for each row
    let descriptions = rows.map(row => row.querySelector('td:nth-child(2)').textContent);

    // Adds information to the descriptions about what the variables mean for certain statistical variables
    // This information will be seen by chat-GPT but not the user
    for (let i = 0; i < tableTitles.length; i++) {
        if (tableTitles[i].endsWith('_n')) {
            descriptions[i] += " This variable refers to the number of people used to construct the sample in total, not the actual number of people who this applies to.";
        }
        if (tableTitles[i].endsWith('_se')) {
            descriptions[i] += " This variable refers to standard error, not the actual variable. Almost never give this to the user.";
        }
        if (tableTitles[i].includes('_p50')) {
            descriptions[i] += "This variable refers to people specifically who grew up in the 50th percentile of the income distribution. Make sure to mention this.";
        }
        if (tableTitles[i].includes('_p25')) {
            descriptions[i] += "This variable refers to people specifically who grew up in the 25th percentile of the income distribution. Make sure to mention this.";
        }
    }

    // Stores the text to send to the server with the top 10 variables
    let text = "";
    // The number of variables added to text
    let processedCount = 0;
    // A list of the indexes of the rows that were added to text
    let toShow = [];

    // Flattens linkedRows
    linkedRows = linkedRows.flat();

    // Loops through the linked rows, adding variable to text and toShow until 10 have been added
    for (let i = 0; i < linkedRows.length && processedCount < 10; i++) {
        // Gets the variable name and removes any statistical markers like mean, se, or n
        let url = new URL(rows[linkedRows[i]].querySelector('td:nth-child(1) a').href).searchParams.get('var');
        const parseVarName = url.split('_').filter(part => !addOns.includes(part)).join('_');
        // If this variable has already been used in the chat for the same location name, skip it
        if (variables.includes(parseVarName) && locations[variables.indexOf(parseVarName)] == locationNameQ) continue;

        // Adds the variable name and description to text
        text += `VARIABLE NAME: ${url} VARIABLE DESCRIPTION: ${descriptions[linkedRows[i]]} LINE BREAK `;
        // Adds the variable name to variables
        variables.push(parseVarName);
        // increments addedToVariables
        addedToVariables++;
        // Adds the location name to locations
        locations.push(locationNameQ);
        // Adds the index of the row to toShow
        toShow.push(linkedRows[i]);
        
        // Increments processedCount
        processedCount++;
    }

    // Removes any rows that were not used
    for (let i = rows.length - 1; i >= 0; i--) {
        if (!toShow.includes(i)) {
            rows[i].remove();
        }
    }

    return text;
}

// Uses chat-GPT to pick a variable to describe and then describes that variable
// If a location was specified, returns true
// Otherwise, puts the data and description in the chat
function pickVarAndDescribe(table, variableText) {
    // Adds the available variables to the chat along with additional information about them
    messages.push({ role: 'assistant', content: variableText, id : table.id });
    messages.push({ role: 'assistant', content: "THE USER DOES NOT SEE THIS MESSAGE: Variables with _n in their names do not refer to the number of people who have a certain outcome or did a certain thing. Instead, these variables refer to the number of people used to make a estimate in another variable. Almost never give a variable ending in _n to the user. Variable with pSOMENUMBER like p50 in them only refer to people with parents in a specific income bracket. Make sure to mention this to the user in descriptions." });

    // Figures out if a location was specified
    let usingLocation;
    if (locationTypeQ != null) {
        appendMessage('error', 'Looking for location specific data <span class="animate-ellipsis"></span>');
        usingLocation =  true;
    } else {
        usingLocation =  false;
    }

    // Adds a message to the chat to show that the chatbot is generating a response
    if (!usingLocation) {
        appendMessage('error', 'Generating a response <span class="animate-ellipsis"></span>');
    }

    // Asks the server to pick a variable
    fetch('http://127.0.0.1:3000/pickVarAndDescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    })
    .then(response => response.json())
    .then(data => {
        // Removes the placeholder message
        removeLastMessage();
        
        let pars = JSON.parse(data.reply);

        // Checks if the server found a variable that would help
        // If so, uses that variable
        // If not, removes all added variables from variable and locations and adds an error message to the chat
        if (pars['found'] === 'true') {
            const toShow = pars['name'];

            // Remove all values from variables and locations that are not being used
            const rows = Array.from(table.querySelectorAll('tr'));
            for (let i = 0; i < addedToVariables; i++) {
                if (variables[variables.length - 1 - i] !== toShow && variables[variables.length - 1 - i] + "_mean" !== toShow) {
                    variables.splice(variables.length - 1 - i, 1);
                    locations.splice(locations.length - 1 - i, 1);
                    i--;
                    addedToVariables--;
                }
            }

            // Checks if the variable table needs to be displayed or if only the datable should be displayed
            if (variables.includes(toShow) && locations[variables.indexOf(toShow)] != locationNameQ) displayVariableDescriptionTable = false;
            if (variables.includes(toShow.replace(/_mean$/, '')) && locations[variables.indexOf(toShow.replace(/_mean$/, ''))] != locationNameQ) displayVariableDescriptionTable = false;
            
            // Removes all rows from the table that are not being used
            for (let I = rows.length - 1; I >= 0; I--) {
                const row = rows[I];
                const variableName = new URL(row.querySelector('td:nth-child(1) a').href).searchParams.get('var');
                if (variableName !== toShow) {
                    row.remove();
                }
            }

            // If there are no rows left in the table, adds an error message to the chat
            if (Array.from(table.querySelectorAll('tr')).length === 0) {
                removeLastMessage();
                Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
                appendMessage('error', 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?');
                messages.push({ role: 'assistant', content: 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?' });
                
                return false;
            }

            // Takes the message specifying the variable options and replaces it with the picked variable
            replaceVariableContent(toShow);

            // If a location was specified, calls the function to get location specific data, otherwise, puts the variable and description in the chat
            if (usingLocation) {
                return true;
            } else {
                appendMessage('error des', pars['response']);
                messages.push({ role: 'assistant', content: pars['response'] });
                if (displayVariableDescriptionTable) {
                    Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('hidden'));
                }
                Array.from(document.getElementsByClassName('showLatter1')).forEach(element => element.classList.remove('hidden'));
                
                return false;
            }
        } else {
            for (let i = 0; i < addedToVariables; i++) {
                variables.splice(variables.length - 1 - i, 1);
                locations.splice(locations.length - 1 - i, 1);
                i--;
                addedToVariables--;
            }
            
            // check the beginning of last message in messages content
            if (messages[messages.length - 1].content.startsWith("Looking for location specific data")) {
                removeLastMessage();
            }
            Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
            appendMessage('error', 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?');
            messages.push({ role: 'assistant', content: 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?' });
            
            return false;
        }
    });
}

// Goes through all the messages, taking the first message that has the current picked variable in it and replacing the whole message with just that variable
// This is done to get rid of context for picking which variable to show that is no longer needed
function replaceVariableContent(toShow) {
    // Iterates over all messages starting at the end
    for (let i = messages.length - 1; i >= 0; i--) {
        let content = messages[i].content;
        
        // Check if the content starts with "VARIABLE NAME:"
        if (content.startsWith("VARIABLE NAME:")) {
            // Parses the message by "LINE BREAK"
            let parts = content.split("LINE BREAK");
            
            // Find the part that contains the variable to show and replace the content with that part
            // Stops iterating and returns
            for (let part of parts) {
                if (part.trim().match(new RegExp(`^VARIABLE NAME: ${toShow} VARIABLE DESCRIPTION:`))) {
                    // Extract the relevant part
                    let result = part.trim();
                    // Replace the content in the messages list
                    
                    messages[i].content = result;
                    return;
                }
            }
        }
    }
}

// Uses chat-GPT to describe the data that has been found and then puts that description in the chat
// Makes the data visible
function describeLocationData() {
        appendMessage('error', 'Generating a response <span class="animate-ellipsis"></span>');
        fetch('http://127.0.0.1:3000/describeLocationData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        })
            .then(response => response.json())
            .then(data => {
                removeLastMessage();
                appendMessage('des error', data.reply);
                messages.push({ role: 'assistant', content: data.reply });
                if (displayVariableDescriptionTable) {
                    Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('hidden'));
                }
                Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
                Array.from(document.getElementsByClassName('showLatter1')).forEach(element => element.classList.remove('hidden'));
            });
}

// Takes in a list of number and parses them
// Splits the numbers into two parts and removes leading zeros and returning a list of lists where the first list has the first parts and the second list has the second parts
// The first number is the first two digits, and the second number is the rest of the digits
function splitAndRemoveLeadingZeros(numbers) {
    const firstParts = [];
    const secondParts = [];

    // Iterates over each number
    numbers.forEach(number => {
        // Convert number to string to manipulate the digits
        const numberStr = number.toString();
        
        // Split the string into two parts
        const firstPart = numberStr.slice(0, 2);
        const secondPart = numberStr.slice(2);
        
        // Convert parts to numbers to remove leading zeros and push to respective lists
        const firstPartNoLeadingZeros = parseInt(firstPart, 10);
        const secondPartNoLeadingZeros = parseInt(secondPart, 10);
        
        firstParts.push(firstPartNoLeadingZeros);
        secondParts.push(secondPartNoLeadingZeros);
    });

    return [firstParts, secondParts];
}

// Gets the location specific data table
async function getLocationData(table) {
    // Gets the sheet name and variable name for the table
    const result = extractLinkData(table);

    // Tries to get the data. After successfully or unsuccessfully getting the data, calls the next function to write a description
    try {
        // Changes the sheet name to match the location type
        if (result.correspondingSheet == "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "Household Income and Incarceration for Children from Low-Income Households by Commuting Zone, Race, and Gender"
        } else if (result.correspondingSheet == "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile"
        } else if (result.correspondingSheet == "Neighborhood Characteristics by Census Tract" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "Neighborhood Characteristics by Commuting Zone"
        } else if (result.correspondingSheet == "in5Not4" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile"
        }
        if (result.correspondingSheet == "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender" && (locationTypeQ == "county" || locationTypeQ == "counties in state" || locationTypeQ == "all US counties")) {
            result.correspondingSheet = "Household Income and Incarceration for Children from Low-Income Households by County, Race, and Gender"
        } else if (result.correspondingSheet == "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile" && (locationTypeQ == "county" || locationTypeQ == "counties in state" || locationTypeQ == "all US counties")) {
            result.correspondingSheet = "All Outcomes by County, Race, Gender and Parental Income Percentile"
        } else if (result.correspondingSheet == "Neighborhood Characteristics by Census Tract" && (locationTypeQ == "county" || locationTypeQ == "counties in state" || locationTypeQ == "all US counties")) {
            result.correspondingSheet = "Neighborhood Characteristics by County"
        }

        // Returns an error if the user wants census tract data for a variable that is not available at that level
        if (result.correspondingSheet == "in5Not4" && (locationTypeQ == "address" || locationTypeQ == "census tracts in state")) {
            removeLastMessage();
            appendMessage('showLatter1 hidden error', `I'm sorry, ${result.shortestVar} is not available for ${locationNameQ}. I can only provide that data for commuting zones, counties, and counties by state.`)
            messages.push({ role: 'assistant', content: `I'm sorry, ${result.shortestVar} is not available for ${locationNameQ}. I can only provide that data for commuting zones, counties, and counties by state.` });
            return true;
        }

        // Fetches the data
        const data = await fetchDataLoc(result.shortestVar, result.correspondingSheet);

        // Checks what specific type of location the user wants the data for and filters the fetched data to only include data for this location
        let filteredRows;
        switch (locationTypeQ) {
            case 'county':
                const countyCodeC = await getCountyIdFromName(locationNameQ);
                const [stateCode1, countyCode1] = splitAndRemoveLeadingZeros(countyCodeC);
                filteredRows = await filterRowsByCountyId(data.tableData, countyCode1, stateCode1);
                break;
            case 'commuting zone':
                filteredRows = await filterRowsByCommutingZoneName(data.tableData, locationNameQ);
                break;
            case 'address':
                const [tractId, stateCode, countyCode] = await getTractIdFromAddress(locationNameQ);
                filteredRows = await filterRowsByTractId(data.tableData, tractId, stateCode, countyCode);
                break;
            case 'counties in state':
                let stateId1 = await getStateIdFromName(locationNameQ);
                filteredRows = await filterRowsByStateId(data.tableData, stateId1);
                break;
            case 'census tracts in state':
                let stateId2 = await getStateIdFromName(locationNameQ);
                filteredRows = await filterRowsByStateId(data.tableData, stateId2);
                break;
            case 'all US counties':
                filteredRows = data.tableData.slice(1).filter(row => row[0] !== "");
                break;
            default:
                throw new Error('Invalid location type');
        }

        // If the data was available for the location, adds the data to the chat in a hidden table
        if (filteredRows.length > 0) {
            removeLastMessage();
            if (locationNameQ == "") {
                locationNameQ = "the full US";
            }
            displayLocationData(locationNameQ, data.units, data.tableData[0], filteredRows);
        } else {
            removeLastMessage();
            appendMessage('error', `That variable is not available for ${locationNameQ}.`)
            messages.push({ role: 'assistant', content: `That variable is not available for ${locationNameQ}.` });
        }
    } catch (error) {
        removeLastMessage();
        appendMessage('showLatter1 hidden error', `Data is only available for commuting zones, addresses (census tracts), counties, counties by state, all US counties, and census tracts by state. I don't think ${locationNameQ} falls into any of these categories.`)
        messages.push({ role: 'assistant', content: `Data is only available for commuting zones, addresses (census tracts), counties, counties by state, all US counties, and census tracts by state. I don't think ${locationNameQ} falls into any of these categories.` });
    }

    return true;
}
  
// Gets the data for a specific variable from a specific sheet
async function fetchDataLoc(variable, sheet) {
    const response = await fetch('http://127.0.0.1:3000/getData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variable, sheet }),
    });
    return response.json();
}

// takes in an address and returns the tract id, state code, and county code for that address
async function getTractIdFromAddress(address) {
    const response = await fetch('http://127.0.0.1:3000/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    const data = await response.json();

    let tractId = data.result.addressMatches[0].geographies['Census Block Groups'][0].TRACT;
    let stateCode = data.result.addressMatches[0].geographies['Census Block Groups'][0].STATE;
    let countyCode = data.result.addressMatches[0].geographies['Census Block Groups'][0].COUNTY;
    return [tractId.replace(/^0+/, ''), stateCode.replace(/^0+/, ''), countyCode.replace(/^0+/, '')];
}

// Gets the county code for a county name
async function getCountyIdFromName(countyName) {
    const response = await fetch(`http://127.0.0.1:3000/get_county_code?county=${encodeURIComponent(countyName)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    if (data.county_codes) {
        return data.county_codes;
    } else {
        throw new Error('County not found');
    }
}

// Gets the state id for a state name
async function getStateIdFromName(stateName) {
    const response = await fetch(`http://127.0.0.1:3000/get_state_id?state=${encodeURIComponent(stateName)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    if (data.state_id) {
        return data.state_id;
    } else {
        throw new Error('State not found');
    }
}

// Returns the data that matches the tract id, state code, and county code
async function filterRowsByTractId(tableData, tractId, stateCode, countyCode) {
    const filteredRows = tableData.filter(row => {
        if (row.length < 3) return false; // Ensure the row has at least 3 columns
        const rowStateCode = row[1].toString().trim();
        const rowCountyCode = row[3].toString().trim();
        const rowTractId = row[4].toString().trim();
        return rowStateCode == stateCode && rowTractId == tractId && rowCountyCode == countyCode;
    });

    return filteredRows;
}

// Returns the data that matches the state code and county code
async function filterRowsByCountyId(tableData, countyCodes, stateCodes) {
    const filteredRows = tableData.filter(row => {
        if (row.length < 2) return false; // Ensure the row has at least 2 columns
        const rowCountyCode = row[3].toString().trim();
        const rowStateCode = row[1].toString().trim();
        for (let i = 0; i < countyCodes.length; i++) {
            if (countyCodes[i] == rowCountyCode && stateCodes[i] == rowStateCode) {
                return true;
            }
        }
    });

    return filteredRows;
}

// Returns the data that matches the state id
async function filterRowsByStateId(tableData, stateId) {
    const filteredRows = tableData.filter(row => {
        if (row.length < 2) return false; // Ensure the row has at least 2 columns
        const rowStateCode = row[1].toString().trim();
        
        if (stateId == rowStateCode) {
            return true;
        }
    });

    return filteredRows;
}

// Returns the data that matches the commuting zone name
async function filterRowsByCommutingZoneName(tableData, commutingZoneName) {
    const filteredRows = tableData.filter(row => {
        if (row.length < 3) return false; // Ensure the row has at least 3 columns
        return row[1].toString().trim().toLowerCase().includes(commutingZoneName.toLowerCase());
    });

    return filteredRows;
}

// Displays the location data in a table and adds information about the table to storedVariables
function displayLocationData(location, units, headers, filteredRows) {
    // generate a random 10 digit number to act as an id
    const randomNumber = Math.floor(Math.random() * 10000000000);
    appendMessage('error hidden showLatter1', `Here is the data for ${location}. Each row represents a ${units}. ` + '<a href="#" id="' + randomNumber + '" onclick="downloadTableAsXlsx(event)" class="download-link"><img height="1em" width="1em" src="' + downloadIconUrl + '" alt="Download"> Click here to download</a>' +'<a href="#" id="' + randomNumber + '" onclick="openGraphPopup(event)" class="graph-link"><img height="1em" width="1em" src="' + graphIconUrl + '" alt="Graph"> Click here to graph this data with ...</a>');
    messages.push({ role: 'assistant', content: `Here is the data for ${location}. Each row represents a ${units}.` });
    displayFilteredTable(headers, filteredRows, randomNumber);
    storedVariables[randomNumber] = [locationNameQ, locationTypeQ];
}

// Creates a graph and displays it in the chat
function graphVariable(variable, otherKey) {
    // Closes the graphing popup
    closeGraphPopup();
    
    // Gets the data from the tables that have the data that needs to be graphed
    const table1 = document.getElementById("t" + otherKey);
    const table2 = document.getElementById("t" + variable[1]);
    const rows1 = Array.from(table1.rows).slice(1);
    const rows2 = Array.from(table2.rows).slice(1);
    let xData = [];
    let yData = [];
    rows1.forEach(row => {
        const cells = row.cells;
        xData.push(parseFloat(cells[cells.length - 1].textContent)); // y-axis data from the rightmost column
    });
    rows2.forEach(row => {
        const cells = row.cells;
        yData.push(parseFloat(cells[cells.length - 1].textContent)); // y-axis data from the rightmost column
    });

    // Sets up parameters for the graph
    const trace = {
        x: xData,
        y: yData,
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 15, // Adjust marker size
            color: 'rgba(80, 161, 148, 0.8)', // Adjust marker color
            line: {
                color: 'rgba(80, 161, 148, 1)',
                width: 1
            }
        }
    };
    const layout = {
        title: `Scatter Plot of ${variable[0]} vs ${table1.rows[0].cells[table1.rows[0].cells.length - 1].textContent}`,
        titlefont: {
            size: 18,
            color: '#444'
        },
        xaxis: { 
            title: table1.rows[0].cells[table1.rows[0].cells.length - 1].textContent,
            titlefont: {
                size: 13.5,
                color: '#444'
            },
            tickfont: {
                size: 10.5,
                color: '#444'
            }
        },
        yaxis: { 
            title: variable[0],
            titlefont: {
                size: 13.5,
                color: '#444'
            },
            tickfont: {
                size: 10.5,
                color: '#444'
            }
        },
        margin: {
            l: 60,
            r: 60,
            b: 60,
            t: 60,
            pad: 6
        },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        showlegend: false,
        hovermode: 'closest'
    };
    const data = [trace];

    // Creates a div to hold the graph adds it to the document, making it hidden
    const plotDiv = document.createElement('div');
    plotDiv.id = 'plotDiv';
    plotDiv.style.display = 'none';
    document.body.appendChild(plotDiv);
    
    // Creates a new graph and adds it to the hidden div. Makes the div visible and adds it to the chat
    // Deletes the temporary div
    Plotly.newPlot(plotDiv, data, layout);
    plotDiv.style.display = 'block';
    appendMessage('error graph', plotDiv.outerHTML);
    plotDiv.remove();
}

// Downloads the table as an xlsx file that is connected to the download link that was just clicked
function downloadTableAsXlsx(event) {
    event.preventDefault();

    try {
        // Gets the table
        var link = event.currentTarget;
        var linkId = link.id;
        var table = document.getElementById("t" + linkId);
        if (!table) {
            return;
        }

        // Makes the data into a xlsx file and downloads it
        var wb = XLSX.utils.book_new();
        var ws_data = [];
        for (var r = 0, n = table.rows.length; r < n; r++) {
            var row = table.rows[r];
            var row_data = [];
            for (var c = 0, m = row.cells.length; c < m; c++) {
                row_data.push(row.cells[c].innerText);
            }
            ws_data.push(row_data);
        }
        var ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, 'table.xlsx');
    } catch (error) {
        console.error('Error in downloadTableAsXlsx:', error);
    }
}

// Displays a table with the headers and rows provided
function displayFilteredTable(headers, rows, id) {
    // Creates the table and adds it to the chat
    let text = '<table id="t' + id + '" class="table table-bordered dataTable">';
    text += '<tr>' + headers.map(header => `<td>${header}</td>`).join('') + '</tr>';
    rows.forEach(row => {
        text += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    });
    text += '</table>';
    appendMessage('botBig hidden showLatter1', text);
    const truncatedText = text.length > 1000 ? text.slice(0, 1000) : text;

    // Adds a section of the table to messages so the chatbot can see it
    messages.push({ role: 'assistant', content: truncatedText });

    // Selects the table
    const table = document.querySelectorAll('table')[document.querySelectorAll('table').length - 1];
    
    // Hides rows past the 10th row, adding a show more button to display them
    const rows2 = table.querySelectorAll('tr');
    if (rows2.length > 10) {
        // Hide rows past the 10th row
        for (let i = 10; i < rows2.length; i++) {
            rows2[i].classList.add('hidden');
        }

        // Create and append the "Load more" link
        const loadMoreLink = document.createElement('a');
        loadMoreLink.href = '#';
        loadMoreLink.textContent = 'Load more';
        loadMoreLink.style.display = 'block';
        loadMoreLink.style.cursor = 'pointer';
        loadMoreLink.classList.add('load-more-link1');

        loadMoreLink.addEventListener('click', function(event) {
            event.preventDefault();
            for (let i = 10; i < rows2.length; i++) {
                rows2[i].classList.remove('hidden');
            }
            loadMoreLink.remove();
        });

        table.parentNode.insertBefore(loadMoreLink, table.nextSibling);
    }
}

// Remakes a link with new information
function remakeLink(link, lin, ti, options) {
    // Removes duplicate values from each list in options
    let newOptions = options.map(opt => [...new Set(opt)]);

    // Makes a new link with dropdowns with the proper options and text with hrefs that have information on how to download the data
    // Replaces the old link with the new link
    let newLink = '<div>';
    if (ti.length !== 0) {
        ti[0].forEach((_, i) => {
            if (newOptions[i].length === 0) {
                newLink += `<a target="_blank" disabled class="broken" onclick="clickLink(event)" href="${lin[0]}">${ti[0][i]}</a>`;
            } else {
                newLink += makeDropDown(newOptions[i], lin[0]);
            }
            if (i !== ti[0].length - 1) {
                newLink += '<a target="_blank" disabled class="broken" onclick="clickLink(event)" href="${lin[0]}">_</a>';
            }
        });
        newLink += "</div>";
        link.outerHTML = newLink;
    }
}

// Creates a select element with the provided options
function makeDropDown(options) {
    return `
            <select class="notDropDown" disabled>
                ${options.map(option => `<option value="${option}">${option}</option>`).join('')}
            </select>
    `;
}

// Takes a screenshot of a scatter plot and downloads the image
function captureElement(event) {
    // Start from the event target
    let currentElement = event.target;

    // Traverse the DOM upwards and then search for siblings
    while (currentElement) {
        let sibling = currentElement.nextElementSibling;
        while (sibling) {
            // If it finds the right scatter plot takes a screen shot of it and then download the image
            if ((sibling.classList.contains('error') && sibling.classList.contains('graph')) || sibling.classList.contains('dtd')) {
                // Take a screenshot of the element using html2canvas
                html2canvas(sibling).then(canvas => {
                    // Create a link element to download the screenshot
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL('image/png');
                    link.download = 'screenshot.png';
                    link.click();
                });
                return; // Exit function after taking screenshot
            }
            sibling = sibling.nextElementSibling;
        }
        // Move up to the parent element and continue the search
        currentElement = currentElement.parentElement;
    }
}

// Gets the html code for a map and downloads it in an html file
function captureElementM(event) {
    // Start from the event target
    let currentElement = event.target;

    // Traverse the DOM upwards and then search for siblings
    while (currentElement) {
        let sibling = currentElement.nextElementSibling;
        while (sibling) {
            // If it finds the right map, downloads its contents as an html file
            if ((sibling.classList.contains('error') && sibling.classList.contains('graph')) || sibling.classList.contains('dtd')) {
                // Get the inner HTML of the target element
                let innerHTML = sibling.innerHTML;
                // Create a Blob with the inner HTML
                let blob = new Blob([innerHTML], { type: 'text/html' });
                // Create a link element to download the HTML file
                let link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'map.html';
                link.click();
                return; // Exit function after creating the download link
            }
            sibling = sibling.nextElementSibling;
        }
        currentElement = currentElement.parentElement;
    }
}

// Downloads all the selected data from the shopping cart page as xlsx files
function downloadAll(event) {
    event.preventDefault();

    // Gets all the rows in the shopping cart
    const shoppingCartDiv = document.getElementById('shopping-cart-div');
    const rows = shoppingCartDiv ? shoppingCartDiv.querySelectorAll('table tr') : [];

    // Stores if the checkboxes are checked
    const tableCheckboxStatuses = [];
    // Stores the values to any dropdowns
    const tableDropdownValues = [];
    // Stores the sheet name and variable names to get the data for
    const tableLinkParams = [];
    // Holds a list of lists with teh titles of each variable, leaving blank strings for select elements
    const nt = [];

    // Iterates over each row, populating the lists above
    rows.forEach(row => {
        // gets the the first cells
        const firstColumn = row.querySelectorAll('td').item(0);
        if (firstColumn) {
            // Creates an list of lists where each list is a dropdown with the selected values in it
            // Stores it in tableDropDownValues
            const dropdowns = firstColumn.querySelectorAll('select');
            const dropdownValues = Array.from(dropdowns).map(dropdown => {
                return Array.from(dropdown.selectedOptions).map(option => option.value);
            });
            tableDropdownValues.push(dropdownValues);

            // Get the sheet name and current variable name from the link and adds it to tableLinkParams
            const link = firstColumn.querySelector('a');
            if (link) {
                const urlParams = new URLSearchParams(new URL(link.href).search);
                const varParam = urlParams.get('var');
                const sheetParam = urlParams.get('sheet');
                tableLinkParams.push({ var: varParam, sheet: sheetParam });
            } else {
                tableLinkParams.push({ var: null, sheet: null });
            }
        }

        // Get the checkbox status in the last cell as an array of arrays with true or false and adds it to tableCheckboxStatuses
        const lastColumn = row.querySelectorAll('td').item(2);
        if (lastColumn) {
            const checkboxes = lastColumn.querySelectorAll('input[type="checkbox"]');
            const checkboxStatuses = Array.from(checkboxes).map(checkbox => checkbox.checked);
            tableCheckboxStatuses.push(checkboxStatuses);
        }

        // Fills lp with all the non option elements
        let lp;
        try {
            lp = row.querySelectorAll('td').item(0).querySelector("div").querySelectorAll("*:not(option)");
        } catch (error) {
            lp = row.querySelectorAll('td').item(0).querySelectorAll("*:not(option)");
        }

        // Adds a list to nt with all the elements in lp, putting the text for links and a black string for select elements
        nt.push([]);
        lp.forEach((link) => {
            if (link.classList.contains("broken")) {
                nt[nt.length - 1].push(link.innerHTML);
            } else {
                nt[nt.length - 1].push("");
            }
        });
    });

    // Creates a data object
    let tableData = {
        checkboxes: tableCheckboxStatuses,
        dropdowns: tableDropdownValues,
        links: tableLinkParams,
        whatever: nt
    };

    // Loops through each different variable, downloading the requested data
    for (let i = 0; i < tableData.links.length; i++) {
        // Makes an object with the data for the current variable
        let data = {
            checkboxes: [tableData.checkboxes[i]],
            dropdowns: [tableData.dropdowns[i]],
            links: [tableData.links[i]],
            whatever: [tableData.whatever[i]]
        }

        // If non of the dropdowns are clicked continues
        if (data.dropdowns.length != 0) {
            let con = false;
            data.dropdowns[0].forEach((dropdown) => {
                if (dropdown.length == 0) {
                   con = true;
                }
            });
            if (con) {
                continue;
            }
        }

        // Recursive function to generate all the combinations of the dropdowns
        function generateCombinations(dropdowns, varNames, index) {
            // creates a copy of variable names
            varNames = [...varNames];
            // Returns that copy if all dropdowns have been iterated over
            if (index === dropdowns.length) {
                return varNames;
            }

            // If on the first dropdown, adds all selected options for that dropdown to variable name and call the function again
            if (index == 0) {
                for (let option of dropdowns[0]) {
                    varNames.push(option);
                }
                return generateCombinations(dropdowns, varNames, 1);
            } else {
                // Otherwise, for each set of options, make a copy for each of the options for the current dropdown and calls the function again
                let newVarNames = [];
                for (let base of varNames) {
                    for (let option of dropdowns[index]) {
                        if (base instanceof Array) {
                            newVarNames.push([...base,  option]);
                        } else {
                            newVarNames.push([base, option]);
                        }
                        
                    }
                }
                return generateCombinations(dropdowns, newVarNames, index + 1);
            }
        }

        // Gets a list of lists with all the combinations of the dropdowns
        let varNames = generateCombinations(data.dropdowns[0], [], 0);
      
        // Turns the varNames into actual string variable names
        let finalVarNames = [];
        for (let base of varNames) {
            let name = "";
            let dropdownIndex = 0;
        
            for (let part of data.whatever[0]) {
                if (part === "") {
                    name += base[dropdownIndex];
                    dropdownIndex++;
                } else {
                    name += part;
                }
            }
        
            finalVarNames.push(name);
        }
        varNames = finalVarNames;

        // Using the checkbox information, fetches the selected geographical level for each varNames and downloads it as xlsx
        if (data.checkboxes[0].length == 2) {
                if (data.checkboxes[0][0]) {
                    varNames.forEach((name) => {
                        fetchCountyData(data.links[0].sheet, name);
                    });
                }
                if (data.checkboxes[0][1]) {
                    varNames.forEach((name) => {
                        fetchCommutingZoneData(data.links[0].sheet, name);
                    });
                }
        } else {
            if (data.checkboxes[0][0]) {
                varNames.forEach((name) => {
                    fetchCensusTractData(data.links[0].sheet, name);
                });
            }
            if (data.checkboxes[0][1]) {
                varNames.forEach((name) => {
                    fetchCountyData(data.links[0].sheet, name);
                });
            }
            if (data.checkboxes[0][2]) {
                varNames.forEach((name) => {
                    fetchCommutingZoneData(data.links[0].sheet, name);
                });
            }
        }
    }
}
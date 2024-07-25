(function() {
    var originalLog = console.log;
    var originalError = console.error;
    var originalWarn = console.warn;

    var consoleContent = "";

    console.log = function(message) {
        try {
            consoleContent += message + "\n";
        } catch (e) {
            alert("Additional debugging data will not be logged.")
        }
        originalLog.apply(console, arguments);
    };

    console.error = function(message) {
        consoleContent += message + "\n";
        originalError.apply(console, arguments);
    };

    console.warn = function(message) {
        consoleContent += message + "\n";
        originalWarn.apply(console, arguments);
    };

    // Function to send data to the server
    async function sendData(data) {
        
        const response = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/save_report', {
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
        const htmlContent = getHTMLContent();
        const comment = document.getElementsByTagName('textarea')[0].value;
        const data = {
            html: htmlContent,
            console: consoleContent,
            comment: comment
        };
        document.getElementById("rb1").disabled = true;
        document.getElementById("rb2").disabled = true;
        document.getElementById("rb1").classList.add('disabled');
        document.getElementById("rb2").classList.add('disabled');
        document.getElementById("rt").innerHTML = 'Saving your report <span class="animate-ellipsis"></span>';
        const response = await sendData(data);
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

function downloadAsXLSX(data, sheetName) {
    data = data.tableData;
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "table");
    XLSX.writeFile(wb, `table.xlsx`);
}

// Function to fetch data for Census Tract
async function fetchCensusTractData(sheet, variable) {
    const data = await fetchDataLoc(variable, sheet);
    downloadAsXLSX(data, sheet);
}

// Function to fetch data for County
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
    downloadAsXLSX(data, newSheet);
}

// Function to fetch data for Commuting Zone
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
    downloadAsXLSX(data, newSheet);
}

document.getElementsByClassName("cart-button")[0].addEventListener("click", function() {
    tables = [];
    dataTables = [];

    // Helper function to capture selected values of dropdowns in a table
    function captureSelectValues(table) {
        const selectValues = [];
        table.querySelectorAll('select').forEach((select, index) => {
            selectValues.push({ index: index, value: select.value });
        });
        return selectValues;
    }

    function applySelectValues(table, selectValues) {
        table.querySelectorAll('select').forEach((select, selectIndex) => {
            const valueObj = selectValues.find(val => val.index == selectIndex);
            if (valueObj) {
                // Update dropdown if match is found
                updateDropdownIfMatch(select, valueObj.value);
            }
        });
    }
    
    function updateDropdownIfMatch(dropdown, targetValue) {
        const option = Array.from(dropdown.options).find(opt => opt.value == targetValue);
        if (option) {
            dropdown.value = targetValue;
            // Set the onchange event handler to onUpdate(event)
            dropdown.dispatchEvent(new Event('change'));
        }
    }

    // Capture tables and their select values
    document.querySelectorAll('table').forEach(table => {
        if (!table.classList.contains('hidden') && !table.closest('div.hidden')) {
            const selectValues = captureSelectValues(table);
            if (table.rows[0].cells.length === 2) {
                // Clone the table element to avoid modifying the original table
                let clonedTable = table.cloneNode(true);

                // Extract the title from the first cell
                let firstCellAnchor = clonedTable.querySelector('td a');
                let title = firstCellAnchor.href;

                // Create the links
                // let links = [
                //     `<n href="#dct">Download Census Tract Data</a><br><br>`,
                //     `<a href="#dc">Download County Data</a>`,
                //     `<br><br><a href="#dcz">Download Commuting Zone Data</a>`
                // ];
                let links = [
                         `<input type="checkbox"> Download Census Tract Data</input><br><br>`,
                         `<input type="checkbox"> Download County Data</input>`,
                         `<br><br><input type="checkbox"> Download Commuting Zone Data</input>`
                ];

                // Remove "Download Census Tract Data" link if the title contains "in5Not4"
                if (title.includes('in5Not4')) {
                    links.shift();
                }

                // Add the links as new columns in the single row
                let row = clonedTable.querySelector('tr');
                row.innerHTML += "<td>" + links.map(link => `${link}`).join('') + "</td>";

                // Find all select elements in the cloned table
                let selectElements = clonedTable.querySelectorAll('select');

                // Convert each select element to a multi-select
                selectElements.forEach(select => {
                    select.multiple = true;
                });

                // Push the modified table HTML and select values to the tables array
                tables.push({ html: clonedTable.outerHTML, values: selectValues });
            } else {
                dataTables.push({ html: table.outerHTML, values: selectValues });
            }
        }
    });

    document.getElementsByClassName("chat-container")[0].classList.toggle("hidden");

    // Create and append a div to the body
    let div = document.createElement('div');
    div.id = "shopping-cart-div";
    document.body.appendChild(div);
    div1 = document.createElement('div');
    div1.id = "scdi";
    div.appendChild(div1);
    div = div1;

    let a = document.createElement('a');
    function close() {
        document.getElementsByClassName("chat-container")[0].classList.toggle("hidden");
        document.getElementById("shopping-cart-div").remove();
    }
    a.innerHTML = '< Return to Chat';
    a.href = "#";

    appendMessageSCDI('message error topMessage', a.outerHTML + " " + '<a href="#" onclick="downloadAll(event)" class="download-link"><img height="1em" width="1em" src="' + downloadIconUrl + '" alt="Download"> Click here to download all selected data</a>');
    div.getElementsByTagName('a')[0].addEventListener('click', close);

    // Helper function to add a category of strings to the div
    function addCategoryToDiv(category, title) {
        if (category.length === 0 || title != "Variable Tables") return;

        let categoryTitle = document.createElement('h2');
        categoryTitle.innerHTML = title;
        appendMessageSCDI('message error des', categoryTitle.outerHTML);

        let combinedTable = document.createElement('table');
        combinedTable.classList.add('table');
        combinedTable.classList.add('table-bordered');

        category.forEach((item, index) => {

            if (title != "Variable Tables") {
                return;
            }

            // Create a temporary container to parse and re-insert the HTML
            let tempDiv = document.createElement('div');
            tempDiv.id = "tempDiv";
            tempDiv.innerHTML = item.html;

            // Remove 'onchange' attributes from 'select' elements
            Array.from(tempDiv.getElementsByTagName('select')).forEach(select => {
                select.removeAttribute('onchange');
            });

            // Get the text from the 2nd column of the table's first row
            let secondColumn = tempDiv.querySelector('table tr td:nth-child(2)');

            // Parse and replace the text
            let updatedText = secondColumn.innerText.replace(/^VARIABLE NAME: [^:]* - VARIABLE DESCRIPTION:/, 'VARIABLE DESCRIPTION:');
            secondColumn.innerText = updatedText;

            // Make any links unclickable while keeping the href attribute
            Array.from(tempDiv.getElementsByTagName('a')).forEach(link => {
                link.addEventListener('click', event => event.preventDefault());
                link.style.pointerEvents = 'none'; // Optional: visually indicate that the link is disabled
                link.style.color = '#916800'; // Optional: visually indicate that the link is disabled
            });

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
    }

    // Add all categories to the div with titles
    //addCategoryToDiv(stats, 'Calculated Statistics');
    //addCategoryToDiv(graphs, 'Scatter Plots');
    //addCategoryToDiv(maps, 'Choropleth Maps');
    addCategoryToDiv(tables, 'Variable Tables');
    //addCategoryToDiv(dataTables, 'Data Tables');

    
    try {
        document.querySelectorAll('a[href="#dc"]').forEach(element => {
            element.addEventListener('click', (event) => fetchCountyData(event));
        });
        
        document.querySelectorAll('a[href="#dcz"]').forEach(element => {
            element.addEventListener('click', (event) => fetchCommutingZoneData(event));
        });
        document.querySelectorAll('a[href="#dct"]').forEach(element => {
            element.addEventListener('click', (event) => fetchCensusTractData(event));
        });
    } catch (error) {
        console.error(error);
    }
});

let chatbotMode = '';
Math.seedrandom('OIP2Seed');

function selectMode(mode) {
    chatbotMode = mode;
    const popup = document.getElementById('popup');
    popup.classList.add('fade-out');
    removeLastMessage();
    appendMessage('error topMessage', "Hello! I'm a bot designed to help you find data! Please ask me anything and I will do my best to find some related data from the Opportunity Atlas paper. (" + chatbotMode + " Mode)");
    if (chatbotMode == "Expert") {
        messages.push({ role: 'assistant', content: "I am talking with an expert. I will assume they understand economics and statistics and are a very serious person who does not like emojis. I am their helpful assistant. I WILL USE THIS IN EVERYTHING I WRITE AND DO, EVEN IN FUNCTION CALLS."});
    } else if (chatbotMode == "Learner") {
        messages.push({ role: 'assistant', content: "I am talking to a person who has the knowledge of a 2nd grader. I will assume they know nothing about economics and statistics, and I will be their teacher. I WILL USE THIS IN EVERYTHING I WRITE AND DO, EVEN IN FUNCTION CALLS."});
    }
    setTimeout(() => {
        popup.style.display = 'none';
    }, 500); // Match this with the transition duration in the CSS
    
}

function openReportPopup() {
    document.getElementById('report-popup').classList.remove('hidden');
    document.getElementsByTagName('textarea')[0].value = '';
}

function closeReportPopup() {
    document.getElementById('report-popup').classList.add('hidden');
}

window.onload = function() {
    document.getElementById('popup').style.display = 'flex';
}

const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');

const race = ["white", "black", "hisp", "asian", "natam", "other", "pooled"];
const gender = ["male", "female", "pooled"];
const percentile = ["p1", "p25", "p10", "p50", "p75", "p100"];

const all = [...race, ...gender, ...percentile];
const addOns = ["n", "mean", "se", "s", "imp", "mean_se"];

let messages = [];
let distances = []; 
let variable = [];
let added = 0;
let locations = [];

const allOptions = [];
const allDescriptions = [];
const allLinks = [];
let linkedRows = [];
let titles = [];

let storedData = {};

let stats = [];
let graphs = [];
let maps = [];
let tables = [];
let dataTables = [];

let genderQ;
let raceQ;
let percentileQ;
let queryQ;
let locationTypeQ;
let locationNameQ;

let variableNameGlobal;

let display = true;

let gotName = false;

messages.push({
    role: 'assistant',
    content: "Only I have the ability to browse the database. You, the user, does not have the ability to use it. I will NEVER use equation formatting because this application can not parse it. I promise to use varying emojis and formatting VERY OFTEN. Data is only available for commuting zones, addresses (census tracts), counties, counties by state, and census tracts by state. If you are given data, never use specific numeric examples or refer to specific locations, just talk about the variable names."
});

appendMessage('error topMessage', "Hello! I'm a bot designed to help you find data! Please ask me anything and I will do my best to find some related data from the Opportunity Atlas paper.");
messages.push({ role: 'assistant', content: "Hello! I'm a bot designed to help you find data! Please ask me anything and I will do my best to find some related data from the Opportunity Atlas paper." });

async function sendMessage() {
    const message = messageInput.value;
    if (message.trim() === '') return;

    appendMessage('user', message);
    messages.push({ role: 'user', content: message });
    messageInput.value = '';

    appendMessage('error', 'Thinking <span class="animate-ellipsis"></span>');

    let wTD = await graphQM(message);
    if(wTD == "create graph") {
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
    }

    try {
        const response = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/des', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });
        const data = await response.json();
        try {
            let pars = JSON.parse(data.reply);
            genderQ = pars["gender"];
            if (genderQ == null) {
                genderQ = "pooled";
            }
            raceQ = pars["race"];
            if (raceQ == null) {
                raceQ = "pooled";
            }
            percentileQ = pars["percentile"];
            if (percentileQ == null) {
                percentileQ = "p50";
            }
            queryQ = pars["query"];
            if (queryQ == null) {
                removeLastMessage();
                appendMessage('error', "Could you specify what data your looking for? For example, you could say education, income, or parental.");
                messages.push({ role: 'assistant', content: "Could you specify what data your looking for? For example, you could say education, income, or parental." });
                return;
            }
            locationTypeQ = pars["location type"];
            if (locationTypeQ == "state") {
                locationTypeQ = "counties in state";
            }
            locationNameQ = pars["location name"];
            
            await fetchData();
        } catch (error) {
            removeLastMessage();
            appendMessage('error', data.reply);
            messages.push({ role: 'assistant', content: data.reply });
        }
        //appendMessage('error', 'Fetching your data ...');
        //await fetchData(question);
    } catch (error) {
        console.error('Error:', error);
        removeLastMessage();
        appendMessage('error', "Sorry, there was an error processing your request.");
    }
}

async function requestSingleStatVar(operation) {
    let longString = "";

    // Populate variableNames and construct the long string for all entries in storedData
    for (let key in storedData) {
        let table = document.getElementById("t" + key);
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let variableType = `${storedData[key][0]} ${storedData[key][1]}`;
                longString += `VARIABLE NAME: ${variableName} VARIABLE TYPE: ${variableType} `;
            }
        }
    }

    // make a copy of messages with one more element
    mgs = [...messages];
    if (longString === "") {
        longString = "None";
    }
    mgs.push({ role: 'user', content: "PROVIDED VARIABLES: " + longString});

    const vars = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/pickSingleStatVar', {   
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "messages": mgs }),
    });
    const varsData = await vars.json();
    try {
        let pars = JSON.parse(varsData.reply);

        let varToStat = getVariableId(pars["variable"], pars["variableType"]);

        if (varToStat == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble calculating that statistic.");
            messages.push({ role: 'assistant', content: "I'm having trouble calculating that statistic." });
            return;
        }

        // get the shet with id varToMap + t and make its contents into a list of lists
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

        let lastColumnData = data.map(row => parseFloat(row[row.length - 1])).filter(value => !isNaN(value));
        if (operation === 'get mean') {
            // Calculate mean
            let sum = lastColumnData.reduce((acc, val) => acc + val, 0);
            removeLastMessage();
            appendMessage('error', `The mean of ${pars["variable"]} is ${sum / lastColumnData.length}. This statistic is calculated by weighting all rows from the data table equally.`);
            messages.push({ role: 'assistant', content: `The mean of ${pars["variable"]} is ${sum / lastColumnData.length}. This statistic is calculated by weighting all rows from the data table equally.`});
            stats.push(`The mean of ${pars["variable"]} is ${sum / lastColumnData.length}. This statistic is calculated by weighting all rows from the data table equally.`);
          } else if (operation === 'get median') {
            // Calculate median
            lastColumnData.sort((a, b) => a - b);
            let middleIndex = Math.floor(lastColumnData.length / 2);
            if (lastColumnData.length % 2 === 0) {
              removeLastMessage();
              appendMessage('error', `The median of ${pars["variable"]} is ${(lastColumnData[middleIndex - 1] + lastColumnData[middleIndex]) / 2}. This statistic is calculated by weighting all rows from the data table equally.`);
              messages.push({ role: 'assistant', content: `The median of ${pars["variable"]} is ${(lastColumnData[middleIndex - 1] + lastColumnData[middleIndex]) / 2}. This statistic is calculated by weighting all rows from the data table equally.`});
              stats.push(`The median of ${pars["variable"]} is ${(lastColumnData[middleIndex - 1] + lastColumnData[middleIndex]) / 2}. This statistic is calculated by weighting all rows from the data table equally.`);
            } else {
                removeLastMessage();
                appendMessage('error', `The median of the data is ${lastColumnData[middleIndex]}. This statistic is calculated by weighting all rows from the data table equally.`);
                messages.push({ role: 'assistant', content: `The median of the data is ${lastColumnData[middleIndex]}. This statistic is calculated by weighting all rows from the data table equally.` });
                stats.push(`The median of the data is ${lastColumnData[middleIndex]}. This statistic is calculated by weighting all rows from the data table equally.`);
            }
          } else if (operation === 'get standard deviation') {
            // Calculate standard deviation
            let mean = lastColumnData.reduce((acc, val) => acc + val, 0) / lastColumnData.length;
            let variance = lastColumnData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / lastColumnData.length;
            removeLastMessage();
            appendMessage('error', `The standard deviation of ${pars["variable"]} is ${Math.sqrt(variance)}. This statistic is calculated by weighting all rows from the data table equally.`);
            messages.push({ role: 'assistant', content: `The standard deviation of ${pars["variable"]} is ${Math.sqrt(variance)}. This statistic is calculated by weighting all rows from the data table equally.` });
            stats.push(`The standard deviation of ${pars["variable"]} is ${Math.sqrt(variance)}. This statistic is calculated by weighting all rows from the data table equally.`);
          }
        
    } catch (error) {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
        return;
    }
}

async function requestDoubleStatVars() {
    let longString = "";

    // Populate variableNames and construct the long string for all entries in storedData
    for (let key in storedData) {
        let table = document.getElementById("t" + key);
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let variableType = `${storedData[key][0]} ${storedData[key][1]}`;
                longString += `VARIABLE NAME: ${variableName} VARIABLE TYPE: ${variableType} `;
            }
        }
    }

    // make a copy of messages with one more element
    mgs = [...messages];
    if (longString === "") {
        longString = "None";
    }
    mgs.push({ role: 'user', content: "PROVIDED VARIABLES: " + longString});

    const vars = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/pickDoubleStatVars', {   
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "messages": mgs }),
    });
    const varsData = await vars.json();
    try {
        let pars = JSON.parse(varsData.reply);

        let varToStat1 = getVariableId(pars["variable1"], pars["variableType1"]);
        let varToStat2 = getVariableId(pars["variable2"], pars["variableType2"]);

        if (varToStat1 == null || varToStat2 == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble calculating that statistic.");
            messages.push({ role: 'assistant', content: "I'm having trouble calculating that statistic." });
            return;
        }

        // get the shet with id varToMap + t and make its contents into a list of lists
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
        // Calculate mean
        let mean1 = lastColumnData1.reduce((acc, val) => acc + val, 0) / lastColumnData1.length;
        let mean2 = lastColumnData2.reduce((acc, val) => acc + val, 0) / lastColumnData2.length;

        let numerator = lastColumnData1.reduce((acc, val, idx) => acc + ((val - mean1) * (lastColumnData2[idx] - mean2)), 0);
        let denominator1 = Math.sqrt(lastColumnData1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0));
        let denominator2 = Math.sqrt(lastColumnData2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0));
        removeLastMessage();
        appendMessage('error', `The correlation between ${pars["variable1"]} and ${pars["variable2"]} is ${numerator / (denominator1 * denominator2)}. This statistic is calculated by weighting all rows from the data tables equally.`);
        messages.push({ role: 'assistant', content: `The correlation between ${pars["variable1"]} and ${pars["variable2"]} is ${numerator / (denominator1 * denominator2)}. This statistic is calculated by weighting all rows from the data tables equally.` });
        stats.push(`The correlation between ${pars["variable1"]} and ${pars["variable2"]} is ${numerator / (denominator1 * denominator2)}. This statistic is calculated by weighting all rows from the data tables equally.`);
    } catch (error) {
        removeLastMessage();
        console.log(error);
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
        return;
    }
}

async function requestMapVars() {
    let longString = "";

    // Populate variableNames and construct the long string for all entries in storedData
    for (let key in storedData) {
        let table = document.getElementById("t" + key);
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let variableType = `${storedData[key][0]} ${storedData[key][1]}`;
                longString += `VARIABLE NAME: ${variableName} VARIABLE TYPE: ${variableType} `;
            }
        }
    }

    // Make a copy of messages with one more element
    mgs = [...messages];
    if (longString === "") {
        longString = "None";
    }
    mgs.push({ role: 'user', content: "PROVIDED VARIABLES: " + longString });

    const vars = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/pickMapVars', {   
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "messages": mgs }),
    });
    const varsData = await vars.json();
    try {
        let pars = JSON.parse(varsData.reply);

        const result = pars["variableType"].replace(' in state', '');

        let varToMap = getVariableId(pars["variable"], pars["variableType"]);

        if (varToMap == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble making that map.");
            messages.push({ role: 'assistant', content: "I'm having trouble making that map." });
            return;
        }

        removeLastMessage();
        // Get the sheet with id varToMap + t and make its contents into a list of lists
        let table = document.getElementById("t" + varToMap);

        let cOT = "county";
        if (table.rows[0].cells[4].textContent == "tract") {
            cOT = "tract";
        }

        let rows = table.rows;
        let data = [];
        for (let i = 1; i < rows.length; i++) {
            let row = [];
            for (let j = 0; j < rows[i].cells.length; j++) {
                row.push(rows[i].cells[j].textContent);
            }
            data.push(row);
        }


        let d = document.createElement('div');
        let randomNum = Math.floor(Math.random() * 1000000);
        d.id = 'md' + randomNum;
        d.style.display = 'none';
        d.style.width = '100%';
        appendMessage('error toDelete', 'Making your map <span class="animate-ellipsis"></span>');
        fetch('https://j2ssg7q1-3000.use.devtunnels.ms/generate_map', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ table: data, geo_level: cOT })
        })
        .then(response => response.json())
        .then(data => {
            removeLastMessage();
            appendMessage('error', `Here is your map of ${pars["variable"]} for ${result}. <a href="#" id="${'li' + randomNum}" onclick="captureElementM(event)" class="download-link"><img height="1em" width="1em" src="${downloadIconUrl}" alt="Download"> Click here to download</a>`);
            messages.push({ role: 'assistant', content: `Here is your map of ${pars["variable"]} for ${result}.` });
            appendMessage('error graph', d.outerHTML);
            if (data.html) {
                document.getElementById('md' + randomNum).innerHTML = data.html;
                maps.push(`Here is your map of ${pars["variable"]} for ${result}. <a href="#" id="${'li' + randomNum}" onclick="captureElementM(event)" class="download-link"><img height="1em" width="1em" src="${downloadIconUrl}" alt="Download"> Click here to download</a>`);
                maps.push('<div id="' + 'md' + randomNum + '">' + data.html + "</div>");
                document.getElementById('md' + randomNum).style.display = 'block';
            } else {
                alert('Failed to generate map.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while generating the map.');
        });

        messages.push({ role: 'assistant', content: "Map created!" });
    } catch (error) {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
        return;
    }
}

async function requestGraphVars() {
    let longString = "";

    // Populate variableNames and construct the long string for all entries in storedData
    for (let key in storedData) {
        let table = document.getElementById("t" + key);
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let variableType = `${storedData[key][0]} ${storedData[key][1]}`;
                longString += `VARIABLE NAME: ${variableName} VARIABLE TYPE: ${variableType} `;
            }
        }
    }

    // make a copy of messages with one more element
    mgs = [...messages];
    if (longString === "") {
        longString = "None";
    }
    mgs.push({ role: 'user', content: "PROVIDED VARIABLES: " + longString});

    const vars = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/pickGraphVars', {   
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "messages": mgs }),
    });
    const varsData = await vars.json();
    try {
        let pars = JSON.parse(varsData.reply);

        let xKey = getVariableId(pars["x"], pars["xType"]);
        let yKey = getVariableId(pars["y"], pars["yType"]);

        const result = pars["xType"].replace(' in state', '');

        if (xKey == null || yKey == null) {
            removeLastMessage();
            appendMessage('error', "I'm having trouble making that plot.");
            messages.push({ role: 'assistant', content: "I'm having trouble making that plot" });
            return;
        }

        removeLastMessage();
        appendMessage('error', `Here is your graph of ${pars["x"]} and ${pars["y"]} for ${result}. <a href="#" onclick="captureElement(event)" class="download-link"><img height="1em" width="1em" src="${downloadIconUrl}" alt="Download"> Click here to download</a>`);
        messages.push({ role: 'assistant', content: `Here is your graph of ${pars["x"]} and ${pars["y"]} for ${result}.` });
        graphs.push(`Here is your graph of ${pars["x"]} and ${pars["y"]} for ${result}.  <a href="#" onclick="captureElement(event)" class="download-link"><img height="1em" width="1em" src="${downloadIconUrl}" alt="Download"> Click here to download</a>`);
        graphVariable([pars["y"], yKey], xKey);
        messages.push({ role: 'assistant', content: "Graph created!" });
    } catch (error) {
        removeLastMessage();
        appendMessage('error', varsData.reply);
        messages.push({ role: 'assistant', content: varsData.reply });
        return;
    }
}

function getVariableId(variableName, variableType) {
    for (let key in storedData) {
        let table = document.getElementById("t" + key);
        if (table) {
            let rows = table.rows;
            if (rows.length > 0 && rows[0].cells.length > 0) {
                let currentVariableName = rows[0].cells[rows[0].cells.length - 1].textContent;
                let currentVariableType = `${storedData[key][0]} ${storedData[key][1]}`;
                
                if (currentVariableName === variableName && currentVariableType === variableType) {
                    return key;
                }
            }
        }
    }
    return null; // Return null if no match is found
}

async function graphQM(message) {
    mgs = [{ role: 'user', content: message }];
    const gQM = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/useCase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "message": mgs }),
        });
    const decision = await gQM.json();
    return JSON.parse(decision.reply).action;
}

function parseQuestion(reply) {
    
    if (reply.includes("DATABASEQUESTION:")) {
        
        return reply.split("DATABASEQUESTION:")[1];
    } else if (reply.includes("DATABASE QUESTION:")) {
        return reply.split("DATABASE QUESTION:")[1];
    }
    
    return '';
}

async function fetchData() {
    try {
        
        // DO THIS AGAIN
        console.log("queryQ: " + queryQ);
        const chatResponse = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "message": queryQ }),
        });
        const chatData = await chatResponse.json();

        if (chatData.reply[0] === "NO") {
            removeLastMessage();
            appendMessage('error', "Hmm. I don't think we have any data on that.");
            messages.push({ role: 'assistant', content: "Hmm. I don't think we have any data on that." });
            return;
        }

        chatData.reply.forEach((row, index) => {
            if (row.startsWith("Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and GenderLINKjail_pooled_pooled_mean")) {
            }
            
        });
        processChatData(chatData);
    } catch (error) {
        console.error('Error:', error);
        removeLastMessage();
        appendMessage('error', "Sorry, there was an error processing your request.");
    }
}

function parseString(input) {
    const questionMatch = input.match(/QUESTION:\s*(.*?)(?:\s*LOCATION:|$)/);
    const locationMatch = input.match(/LOCATION:\s*(.*?)(?:\s*LOCATIONTYPE:|$)/);
    const locationTypeMatch = input.match(/LOCATIONTYPE:\s*(.*?)$/);

    return {
        question: questionMatch ? questionMatch[1].trim() : "",
        location1: locationMatch ? locationMatch[1].trim() : "",
        type: locationTypeMatch ? locationTypeMatch[1].trim() : ""
    };
}

function processChatData(data) {
    removeLastMessage();
    appendMessage('error toDelete', 'Processing your data <span class="animate-ellipsis"></span>');
    setTimeout(() => { }, 20);

    if (data.reply === "ERROR") {
        removeLastMessage();
        appendMessage('error', "Sorry, there was an error processing your request.");
        return;
    }

    distances = data.distances;

    let randomID = Math.floor(Math.random() * 1000000);
    let tableHtml = '<table class="table table-bordered main" id="' + randomID + '">';
    data.reply.forEach(row => {
        let cells = row.split("SPECIAL").map((cell, index) => {
            if (index === 0) {
                let [sheet, varName] = cell.split("LINK");
                return `<td><a href="https://j2ssg7q1-3000.use.devtunnels.ms/viewData?sheet=${sheet}&var=${varName}" target="_blank">${varName}</a></td>`;
            } else {
                return `<td>${cell}</td>`;
            }
        }).join('');
        tableHtml += `<tr>${cells}</tr>`;
    });
    tableHtml += "</table>";

    appendMessage('error hidden showLatter', 'Here is the data I got from the database.');
    messages.push({ role: 'assistant', content: "Here is some data that may help. Give me a second to write up an explanation." });
    appendMessage('bot showLatter hidden', tableHtml);

    removeDups();
    allOptions.push([]);
    allDescriptions.push([]);
    allLinks.push([]);

    condense(document.getElementById(randomID));
    chooseDropdown(document.getElementById(randomID), distances);
}

function chooseDropdown(table, distances) {
    // Get all select elements in the table
    const dropdowns = table.querySelectorAll('select');

    // Function to update a dropdown if it contains the target value
    function updateDropdownIfMatch(dropdown, targetValue) {
        const option = Array.from(dropdown.options).find(opt => opt.value == targetValue);
        if (option) {
            dropdown.value = targetValue;
            dropdown.dispatchEvent(new Event('change'));
            return true;
        }
        return false;
    }

    
    // Iterate through all dropdowns
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

    let text1 = linkRows(table);
    Array.from(document.getElementsByClassName('toDelete')).forEach(element => element.classList.add('hidden'));
    
    //makeGraph(distances);
    answerQuestion(text1, table);
}

function removeTablesFromHtml(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const tables = doc.querySelectorAll('table');
    tables.forEach(table => table.remove());
    
    return doc.body.innerHTML;
}

function appendMessage(sender, message) {
    removeBR();
    removeBR();
    //const formattedMessage = message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    let formattedMessage = message;
    if (sender.split(' ').includes('error')) {
        formattedMessage = marked.parse(message);
        formattedMessage = removeTablesFromHtml(formattedMessage);
    }
    const messageElement = document.createElement('div');
    messageElement.classList.add('message')
    sender.split(' ').forEach(className => messageElement.classList.add(className));
    messageElement.innerHTML = formattedMessage;
    chatBox.appendChild(messageElement);

    let br = document.createElement('br');
    chatBox.appendChild(br);
    br = document.createElement('br');
    chatBox.appendChild(br);
}

function appendMessageSCDI(sender, message) {
    //const formattedMessage = message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    let formattedMessage = message;
    if (sender.split(' ').includes('error')) {
        formattedMessage = marked.parse(message);
        formattedMessage = removeTablesFromHtml(formattedMessage);
    }
    const messageElement = document.createElement('div');
    messageElement.classList.add('message')
    sender.split(' ').forEach(className => messageElement.classList.add(className));
    messageElement.innerHTML = formattedMessage;
    document.getElementById("scdi").appendChild(messageElement);
}

function removeBR() {
    const brs = document.querySelectorAll('br');
    if (brs.length > 0) {
        brs[brs.length - 1].remove();
    }
}

function removeLastMessage() {
    const messages = document.querySelectorAll('.message');
    if (messages.length > 0) {
        messages[messages.length - 1].remove();
    }
}

messageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

function removeDups() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        if (table.classList.contains('dataTable')) return;
        const linkMap = new Map();
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const link = row.querySelector('td:nth-child(1) a');
            const description = row.querySelector('td:nth-child(2)');
            const key = `${link.textContent}|${description.textContent}`;

            if (linkMap.has(key)) {
                row.remove();
            } else {
                linkMap.set(key, true);
            }
        });
    });
}

function condense(table) {
    const tables = Array.from(document.querySelectorAll('table')).filter(table => !table.classList.contains('dataTable'));
    const index = tables.indexOf(table);

    titles = [];
    let descriptions = [];
    let links = [];
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach(row => {
        const link = row.querySelector('td:nth-child(1) a');
        const description = row.querySelector('td:nth-child(2)').textContent;
        titles.push(link.textContent.split("_"));
        descriptions.push(description);
        links.push(link.href);
    });

    let titles1 = titles.map(title => title.map(part => (all.includes(part) ? '' : part)));

    for (let i = 0; i < titles1.length; i++) {
        let options = Array(titles1[i].length).fill([]).map(() => []);
        let des = [];
        let lin = [];
        let ti = [];
        for (let j = i; j < titles1.length; j++) {
            if (arraysEqual(titles1[i], titles1[j])) {
                let added = false;
                titles1[i].forEach((_, k) => {
                    if (titles1[i][k] === '') {
                        added = true;
                        options[k].push(titles[j][k]);
                    }
                });
                if (added) {
                    des.push(descriptions[j]);
                    lin.push(links[j]);
                    ti.push(titles[j]);
                }

                if (j != i) {
                    titles1.splice(j, 1);
                    titles.splice(j, 1);
                    descriptions.splice(j, 1);
                    links.splice(j, 1);

                    rows[j].remove();
                    rows.splice(j, 1);
                    j--;
                }
            }
        }
        if (ti.length != 0) {
            remakeLink(rows[i].querySelector('td:nth-child(1) a'), des, lin, ti, options);
        }
        allOptions[index].push(options);
        allDescriptions[index].push(des);
        allLinks[index].push(lin);
    }
}

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

function linkRows(table) {
    added = 0;
    addedToShow = 0;
    display = true;
    let titlesTogether = titles.map(title => title.filter(part => !addOns.includes(part) && !all.includes(part)).join('_'));
    linkedRows = [];

    const rows = Array.from(table.querySelectorAll('tr'));
    for (let i = 0; i < rows.length; i++) {
        if (linkedRows.some(list => list.includes(i))) continue;
        linkedRows.push([i]);

        for (let j = i + 1; j < rows.length; j++) {
            if (titlesTogether[i] == titlesTogether[j]) {
                linkedRows[linkedRows.length - 1].push(j);
            }
        }
    }

    let tableTitles = titles.map(title => title.join('_'));
    let descriptions = rows.map(row => row.querySelector('td:nth-child(2)').textContent);

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
    }

    let text = "";
    let processedCount = 0;
    let toShow = [];
    linkedRows = linkedRows.flat();

    console.log("new one");
    for (let i = 0; i < 20; i++) {
        let url = new URL(rows[linkedRows[i]].querySelector('td:nth-child(1) a').href).searchParams.get('var');
        const parseVarName = url.split('_').filter(part => !addOns.includes(part)).join('_');

        url = new URL(rows[linkedRows[i]].querySelector('td:nth-child(1) a').href).searchParams.get('var');
        console.log(parseVarName);
    }

    for (let i = 0; i < linkedRows.length && processedCount < 6; i++) {
        let url = new URL(rows[linkedRows[i]].querySelector('td:nth-child(1) a').href).searchParams.get('var');
        const parseVarName = url.split('_').filter(part => !addOns.includes(part)).join('_');
        if (variable.includes(parseVarName) && locations[variable.indexOf(parseVarName)] == locationNameQ) continue;

        url = new URL(rows[linkedRows[i]].querySelector('td:nth-child(1) a').href).searchParams.get('var');
        text += `VARIABLE NAME: ${url} VARIABLE DESCRIPTION: ${descriptions[linkedRows[i]]} LINE BREAK `;
        variable.push(parseVarName);
        added++;
        locations.push(locationNameQ);
        toShow.push(linkedRows[i]);
        
        processedCount++;
    }

    for (let i = rows.length - 1; i >= 0; i--) {
        if (!toShow.includes(i)) {
            rows[i].remove();
            allOptions[allOptions.length - 1].splice(i, 1);
            allDescriptions[allOptions.length - 1].splice(i, 1);
            allLinks[allOptions.length - 1].splice(i, 1);
        }
    }

    return text;
}

function answerQuestion(variableText, table) {
    messages.push({ role: 'assistant', content: variableText });
    messages.push({ role: 'assistant', content: "THE USER DOES NOT SEE THIS MESSAGE: Variables with _n in their names do not refer to the number of people who have a certain outcome or did a certain thing. Instead, these variables refer to the number of people used to make a estimate in another variable. Almost never give a variable ending in _n to the user. Variable with pSOMENUMBER like p50 in them only refer to people with parents in a specific income bracet. Make sure to mention this to the user in descriptions." });
    if (locationNameQ != null) {
        appendMessage('error', 'Looking for location specific data <span class="animate-ellipsis"></span>');
        answerQuestionContinuedLoc(table);
    } else {
        answerQuestionContinued(table);
    }
}

function answerQuestionContinued(table) {
    appendMessage('error', 'Generating a response <span class="animate-ellipsis"></span>');
    fetch('https://j2ssg7q1-3000.use.devtunnels.ms/pickVarAndDescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    })
    .then(response => response.json())
    .then(data => {
        removeLastMessage();
        let fixedData = data.reply.replace(/\\'/g, "'");
        let pars = JSON.parse(fixedData);
        if (pars['found'] === 'true') {
            // Remove all other rows from the table
            const rows = Array.from(table.querySelectorAll('tr'));
            const toShow = pars['name'];
            for (let i = 0; i < added; i++) {
                if (variable[variable.length - 1 - i] !== toShow && variable[variable.length - 1 - i] + "_mean" !== toShow) {
                    variable.splice(variable.length - 1 - i, 1);
                    locations.splice(locations.length - 1 - i, 1);
                    i--;
                    added--;
                }
            }

            if (variable.includes(toShow) && locations[variable.indexOf(toShow)] != locationNameQ) display = false;
            
            variableNameGlobal = toShow;
            for (let I = rows.length - 1; I >= 0; I--) {
                const row = rows[I];
                const variableName = new URL(row.querySelector('td:nth-child(1) a').href).searchParams.get('var');
                if (variableName !== toShow) {
                    row.remove();
                    allOptions[allOptions.length - 1].splice(I, 1);
                    allDescriptions[allOptions.length - 1].splice(I, 1);
                    allLinks[allOptions.length - 1].splice(I, 1);
                }
            }

            if (Array.from(table.querySelectorAll('tr')).length === 0) {
                removeLastMessage();
                Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
                appendMessage('error', 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?');
                messages.push({ role: 'assistant', content: 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?' });
                return;
            }

            // Put the description in the chat
            appendMessage('error des', pars['response']);
            messages.push({ role: 'assistant', content: pars['response'] });
            if (display) {
                Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('hidden'));
            }
            Array.from(document.getElementsByClassName('showLatter1')).forEach(element => element.classList.remove('hidden'));
        } else {
            for (let i = 0; i < added; i++) {
                variable.splice(variable.length - 1 - i, 1);
                locations.splice(locations.length - 1 - i, 1);
                i--;
                added--;
            }
            
            // check the beginning of last message in messages content
            if (messages[messages.length - 1].content.startsWith("Looking for location specific data")) {
                removeLastMessage();
            }
            Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
            appendMessage('error', 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?');
            messages.push({ role: 'assistant', content: 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?' });
        }
    });
}

function replaceVariableContent() {
    // Iterate the list from the end to the beginning
    for (let i = messages.length - 1; i >= 0; i--) {
        let content = messages[i].content;
        
        // Check if the content starts with "VARIABLE NAME:"
        if (content.startsWith("VARIABLE NAME:")) {
            let parts = content.split("LINE BREAK");
            
            for (let part of parts) {
                
                if (part.trim().startsWith(`VARIABLE NAME: ${variableNameGlobal} VARIABLE DESCRIPTION:`)) {
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

function answerQuestionContinuedLoc(table) {
    fetch('https://j2ssg7q1-3000.use.devtunnels.ms/pickVarAndDescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    })
    .then(response => response.json())
    .then(data => {
        let fixedData = data.reply.replace(/\\'/g, "'");
        let pars = JSON.parse(fixedData);
        if (pars['found'] === 'true') {
            // Remove all other rows from the table
            const rows = Array.from(table.querySelectorAll('tr'));
            const toShow = pars['name'];
            for (let i = 0; i < added; i++) {
                if (variable[variable.length - 1 - i] !== toShow && variable[variable.length - 1 - i] + "_mean" !== toShow) {
                    variable.splice(variable.length - 1 - i, 1);
                    locations.splice(locations.length - 1 - i, 1);
                    i--;
                    added--;
                }
            }
            
            variableNameGlobal = toShow;
            for (let I = rows.length - 1; I >= 0; I--) {
                const row = rows[I];
                const variableName = new URL(row.querySelector('td:nth-child(1) a').href).searchParams.get('var');
                if (variableName !== toShow) {
                    row.remove();
                    allOptions[allOptions.length - 1].splice(I, 1);
                    allDescriptions[allOptions.length - 1].splice(I, 1);
                    allLinks[allOptions.length - 1].splice(I, 1);
                }
            }

            if (variable.includes(toShow) && locations[variable.indexOf(toShow)] != locationNameQ) display = false;

            // this one there is no longer a table
            getLocationData(table);
        } else {
            for (let i = 0; i < added; i++) {
                variable.splice(variable.length - 1 - i, 1);
                locations.splice(locations.length - 1 - i, 1);
                i--;
                added--;
            }
            
            removeLastMessage();
            Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
            appendMessage('error', 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?');
            messages.push({ role: 'assistant', content: 'Sorry, I couldn\'t find a variable that would help. 😕 Do you want me to search for something else?' });
        }
    });
}

function answerQuestionContinuedLocDes() {
    replaceVariableContent();
        appendMessage('error', 'Generating a response <span class="animate-ellipsis"></span>');
        fetch('https://j2ssg7q1-3000.use.devtunnels.ms/chatData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        })
            .then(response => response.json())
            .then(data => {
                removeLastMessage();
                appendMessage('des error', data.reply);
                messages.push({ role: 'assistant', content: data.reply });
                if (display) {
                    Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('hidden'));
                }
                Array.from(document.getElementsByClassName('showLatter')).forEach(element => element.classList.remove('showLatter'));
                Array.from(document.getElementsByClassName('showLatter1')).forEach(element => element.classList.remove('hidden'));
            });
}

function splitAndRemoveLeadingZeros(numbers) {
    const firstParts = [];
    const secondParts = [];

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

async function getLocationData(table) {
    if (table.querySelector('tr') === null) {
        removeLastMessage();
        removeLastMessage();
        removeLastMessage();
        appendMessage('showLatter1 hidden error', `Sorry, that data is not available. 😕 Do you want me to search for something else? (Try querying the same data with a more specific prompt or search for something new)`)
        messages.push({ role: 'assistant', content: `Sorry, that data is not available. 😕 Do you want me to search for something else?` });
        Array.from(document.getElementsByClassName('showLatter1')).forEach(element => element.classList.remove('hidden'));
        gotName = true;
        return;
    }
    gotName = false;
    
    const linkData = extractLinkData(table);
    
    const shortestVarLink = selectVarLink(linkData);
    const result = {
      shortestVar: shortestVarLink.var,
      correspondingSheet: shortestVarLink.sheet
    };
  
    // TODO: UPDATE HERE?
    try {
      if (result.correspondingSheet == "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender" && locationTypeQ == "commuting zone") {
         result.correspondingSheet = "Household Income and Incarceration for Children from Low-Income Households by Commuting Zone, Race, and Gender"
      } else if (result.correspondingSheet == "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile"
      } else if (result.correspondingSheet == "Neighborhood Characteristics by Census Tract" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "Neighborhood Characteristics by Commuting Zone"
      } else if (result.correspondingSheet == "in5Not4" && locationTypeQ == "commuting zone") {
            result.correspondingSheet = "All Outcomes by Commuting Zone, Race, Gender and Parental Income Percentile"
      }


      if (result.correspondingSheet == "Household Income and Incarceration for Children from Low-Income Households by Census Tract, Race, and Gender" && (locationTypeQ == "county" || locationTypeQ == "counties in state")) {
        result.correspondingSheet = "Household Income and Incarceration for Children from Low-Income Households by County, Race, and Gender"
     } else if (result.correspondingSheet == "All Outcomes by Census Tract, Race, Gender and Parental Income Percentile" && (locationTypeQ == "county" || locationTypeQ == "counties in state")) {
           result.correspondingSheet = "All Outcomes by County, Race, Gender and Parental Income Percentile"
     } else if (result.correspondingSheet == "Neighborhood Characteristics by Census Tract" && (locationTypeQ == "county" || locationTypeQ == "counties in state")) {
           result.correspondingSheet = "Neighborhood Characteristics by County"
     }

     if (result.correspondingSheet == "in5Not4" && (locationTypeQ == "address" || locationTypeQ == "census tracts in state")) {
        removeLastMessage();
      appendMessage('showLatter1 hidden error', `I'm sorry, ${result.shortestVar} is not available for ${locationNameQ}. I can only provide that data for commuting zones, counties, and counties by state.`)
    messages.push({ role: 'assistant', content: `I'm sorry, ${result.shortestVar} is not available for ${locationNameQ}. I can only provide that data for commuting zones, counties, and counties by state.` });
      answerQuestionContinuedLocDes();
      return;
     }

      const data = await fetchDataLoc(result.shortestVar, result.correspondingSheet);
  
      let filteredRows;
      switch (locationTypeQ) {
        /*case 'address':
          const [tractId, stateCode, countyCode] = await getTractIdFromAddress(locationNameQ);
          
          filteredRows = await filterRowsByTractId(data.tableData, tractId, stateCode, countyCode);
          
          break;
        case 'city':
          const [county, code] = await getCityData(locationNameQ);
          
          const [stateCode1, countyCode1] = splitAndRemoveLeadingZeros(code);
          
          
          filteredRows = await filterRowsByCountyId(data.tableData, countyCode1, stateCode1);
          break;
        case 'county':
          // TODO: Implement county workflow
          break;
        case 'commuting zone':
          // TODO: Implement commuting zone workflow
          break;
        case 'state':
          // TODO: Implement state workflow
          break;
        default:
          throw new Error('Invalid location type');*/
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
        default:
          throw new Error('Invalid location type');
      }
  
      if (filteredRows.length > 0) {
        removeLastMessage();
        displayLocationData(locationNameQ, data.units, data.tableData[0], filteredRows);
      } else {
        removeLastMessage();
        appendMessage('error', `That variable is not available for ${locationNameQ}.`)
        messages.push({ role: 'assistant', content: `That variable is not available for ${locationNameQ}.` });
      }
      answerQuestionContinuedLocDes();
    } catch (error) {
       
      removeLastMessage();
      appendMessage('showLatter1 hidden error', `Data is only available for commuting zones, addresses (census tracts), counties, counties by state, and census tracts by state. I don't think ${locationNameQ} falls into any of these categories.`)
    messages.push({ role: 'assistant', content: `Data is only available for commuting zones, addresses (census tracts), counties, counties by state, and census tracts by state. I don't think ${locationNameQ} falls into any of these categories.` });
      answerQuestionContinuedLocDes();
    }
}
  
function extractLinkData(table) {
    return Array.from(table.rows)
      .map(row => {
        const link = row.cells[0].querySelector('a');
        if (!link) return null;
        const url = new URL(link.href);
        const varParam = url.searchParams.get('var');
        const sheetParam = url.searchParams.get('sheet');
        return varParam ? { var: varParam, sheet: sheetParam, length: varParam.length } : null;
      })
      .filter(data => data !== null);
}
  
function selectVarLink(linkData) {
    const meanEnding = linkData.filter(item => item.var.toLowerCase().endsWith('_mean'));
    if (meanEnding.length > 0) return meanEnding[0];
    const sStarting = linkData.filter(item => item.var.toLowerCase().startsWith('s_'));
    if (sStarting.length > 0) return sStarting[0];
    
    return linkData.reduce((shortest, current) =>
      (current.var.length < shortest.var.length) ? current : shortest
    );
}
  
async function fetchDataLoc(variable, sheet) {
    const response = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/getData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variable, sheet }),
    });
    return response.json();
}
  
async function getTractIdFromAddress(address) {
    const response = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/geocode', {
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

async function getCountyIdFromName(countyName) {
    const response = await fetch(`https://j2ssg7q1-3000.use.devtunnels.ms/get_county_code?county=${encodeURIComponent(countyName)}`, {
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

async function getStateIdFromName(stateName) {
    const response = await fetch(`https://j2ssg7q1-3000.use.devtunnels.ms/get_state_id?state=${encodeURIComponent(stateName)}`, {
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

async function readCSVColumns() {
    try {
        const response = await fetch('https://j2ssg7q1-3000.use.devtunnels.ms/read_state_csv');
        if (!response.ok) {
            throw new Error('Failed to fetch CSV data');
        }
        const data = await response.json();
        return {
            firstColumn: data.firstColumn,
            fourthColumn: data.fourthColumn
        };
    } catch (error) {
        console.error('Error reading CSV file:', error);
        throw error;
    }
}
  
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

async function filterRowsByCommutingZoneName(tableData, commutingZoneName) {
    const filteredRows = tableData.filter(row => {
        if (row.length < 3) return false; // Ensure the row has at least 3 columns
        return row[1].toString().trim().toLowerCase().includes(commutingZoneName.toLowerCase());
    });

    return filteredRows;
}
  
function displayLocationData(location, units, headers, filteredRows) {
    // generate a random 10 digit number
    const randomNumber = Math.floor(Math.random() * 10000000000);
    appendMessage('error hidden showLatter1', `Here is the data for ${location}. Each row represents a ${units}. ` + '<a href="#" id="' + randomNumber + '" onclick="downloadTableAsXlsx(event)" class="download-link"><img height="1em" width="1em" src="' + downloadIconUrl + '" alt="Download"> Click here to download</a>' +'<a href="#" id="' + randomNumber + '" onclick="openGraphPopup(event)" class="graph-link"><img height="1em" width="1em" src="' + graphIconUrl + '" alt="Graph"> Click here to graph this data with ...</a>');
    messages.push({ role: 'assistant', content: `Here is the data for ${location}. Each row represents a ${units}.` });
    displayFilteredTable(headers, filteredRows, randomNumber, units);
    storedData[randomNumber] = [locationNameQ, locationTypeQ];
}

function findRowsWithKeyword(data, keyword) {
    return data.slice(1).filter(row =>
        row.some(cell => cell.toString().toLowerCase().includes(keyword.toLowerCase()))
    );
}

function openGraphPopup(event) {
    event.preventDefault();
    const graphPopup = document.getElementById('graph-popup');
    graphPopup.classList.remove('hidden');
    let id = event.currentTarget.id;
    
    const optionsDiv = document.querySelector('.graph.options');
    optionsDiv.innerHTML = '';

    let variableNames = [];
    // Populate variableNames from the stored data
    for (let key in storedData) {
        if (storedData[key][0] == storedData[event.currentTarget.id][0] && storedData[key][1] == storedData[event.currentTarget.id][1] && key != event.currentTarget.id) {
            let table = document.getElementById("t" + key);
            let rows = table.rows;
            let variableName = rows[0].cells[rows[0].cells.length - 1].textContent;
            variableNames.push([variableName, key]);
        }
    }

    variableNames.forEach(variable => {
        const button = document.createElement('button');
        button.classList.add('mode-button');
        button.classList.add('graph-button');
        button.textContent = variable[0];
        button.onclick = () => graphVariable(variable, id);
        optionsDiv.appendChild(button);
    });
}

function closeGraphPopup() {
    const graphPopup = document.getElementById('graph-popup');
    graphPopup.classList.add('hidden');
}

function closeActGraphPopup() {
    const graphPopup = document.getElementById('graph-img-popup');
    graphPopup.classList.add('hidden');
}

function graphVariable(variable, otherKey) {
    closeGraphPopup();
    
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

    const plotDiv = document.createElement('div');
    plotDiv.id = 'plotDiv';
    plotDiv.style.display = 'none';
    document.body.appendChild(plotDiv);
    
    Plotly.newPlot(plotDiv, data, layout);
    plotDiv.style.display = 'block';
    appendMessage('error graph', plotDiv.outerHTML);
    graphs.push(plotDiv.outerHTML);
    plotDiv.remove();
}

function downloadTableAsXlsx(event) {
    event.preventDefault();

    try {
        var link = event.currentTarget;
        var linkId = link.id;

        var table = document.getElementById("t" + linkId);
        if (!table) {
            return;
        }

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

function displayFilteredTable(headers, rows, id, units) {
    let text = '<table id="t' + id + '" class="table table-bordered dataTable">';
    text += '<tr>' + headers.map(header => `<td>${header}</td>`).join('') + '</tr>';
    rows.forEach(row => {
        text += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    });
    text += '</table>';
    appendMessage('botBig hidden showLatter1', text);
    const truncatedText = text.length > 1000 ? text.slice(0, 1000) : text;
    
    messages.push({ role: 'assistant', content: truncatedText });

    const table = document.querySelectorAll('table')[document.querySelectorAll('table').length - 1];
    
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

function remakeLink(link, des, lin, ti, options) {
    let newOptions = options.map(opt => [...new Set(opt)]);
    let newLink = "<div>";

    ti[0].forEach((_, i) => {
        if (newOptions[i].length === 0) {
            newLink += `<a target="_blank" class="broken" href="${lin[0]}">${ti[0][i]}</a>`;
        } else {
            newLink += makeDropDown(newOptions[i]);
        }
        if (i !== ti[0].length - 1) {
            newLink += '<a target="_blank" class="broken" href="${lin[0]}">_</a>';
        }
    });
    newLink += "</div>";

    link.outerHTML = newLink;
}

function makeDropDown(options) {
    return `<select onchange="onUpdate(event)">
        ${options.map(option => `<option value="${option}">${option}</option>`).join('')}
    </select>`;
}

function update(choices, options, descriptions, links, row) {
    
    
    
    
    

    options = options.filter(option => option.length !== 0);

    let index = -1;
    for (let i = 0; i < options[0].length; i++) {
        if (options.every((opt, j) => choices[j] === opt[i])) {
            index = i;
            break;
        }
    }

    row.querySelectorAll('table tr td:nth-child(1) a').forEach(link => {
        link.href = links[index];
    });
    row.querySelector('td:nth-child(2)').textContent = descriptions[index];
}

function onUpdate(event) {
    const table = event.target.closest('table');
    let index;
    if (document.getElementById('shopping-cart-div') != null) {
        // // Get the innerHTML of the shopping cart div as a string
        // let shoppingCartDiv = document.getElementById('shopping-cart-div');
        // let innerHTMLString = shoppingCartDiv.innerHTML;

        // // Use a regular expression to find all table ids in the string
        // let tableIdRegex = /<table.*?id=["'](.*?)["']/g;
        // let match;
        // let tableIds = [];

        // // Iterate through the matches and store the ids in the list
        // while ((match = tableIdRegex.exec(innerHTMLString)) !== null) {
        //     tableIds.push(match[1]);
        // }

        // // Function to find the index of a specific table id in the list
        // function getTableIdIndex(tableId) {
        //     return tableIds.indexOf(tableId);
        // }

        // index = getTableIdIndex(table.id);
        const elements = Array.from(document.getElementsByClassName("main"));
        index = elements.findIndex(element => element.id === table.id);
    } else {
        index = Array.from(document.getElementsByClassName("main")).indexOf(table);
    }
    const row = event.target.closest('tr');
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    const values = Array.from(row.querySelectorAll('select')).map(selector => selector.value);

    update(values, allOptions[index][rowIndex], allDescriptions[index][rowIndex], allLinks[index][rowIndex], row);
}

function makeGraph(distances) {
    var x = distances;

    // remove values close to 0 from x
    x = x.filter(value => value > 0.0001);

    randomNumber = Math.floor(Math.random() * 1000000);
    appendMessage('error graph', '<div id="myDiv' + randomNumber + '"></div>');

    var trace = {
        x: x,
        type: 'histogram',
        nbinsx: 30
      };
      
      var layout = {
        yaxis: { title: 'Frequency' },
        xaxis: { title: 'Similarity' },
        title: 'Similarity of Data Embeddings and User Query Embedding'
      };
      
      Plotly.newPlot(`myDiv${randomNumber}`, [trace], layout);
}

async function getCityData(cityName) {
    try {
        const response = await fetch(`https://j2ssg7q1-3000.use.devtunnels.ms/get_city_data?city=${encodeURIComponent(cityName)}`);
        const data = await response.json();
        if (response.ok) {
            return [data.county_name, data.county_fips];
        } else {
            throw new Error(data.error || 'Failed to fetch city data');
        }
    } catch (error) {
        console.error('Error:', error);
        displayResult('An error occurred while fetching data.');
        return null; // Return null in case of error
    }
}

async function fetchCSS(file) {
    const response = await fetch(file);
    return await response.text();
}

async function takeSnapshot() {
    // Get the current HTML of the document
    let snapshot = document.documentElement.outerHTML;
    
    // Get the CSS content
    const cssContent = await fetchCSS('style.css');

    // Embed the CSS content into the snapshot
    snapshot = snapshot.replace('</head>', `<style>${cssContent}</style></head>`);

    // Get the snapshot name from the input
    let snapshotName = document.getElementById('snapshotName').value;
    snapshotName = snapshotName ? snapshotName : 'snapshot'; // Default name if input is empty

    // Create a blob with the snapshot content
    let blob = new Blob([snapshot], { type: 'text/html' });

    // Create a link element
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${snapshotName}.html`;

    // Append the link to the body
    document.body.appendChild(link);

    // Trigger the download by simulating a click
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
}

function captureElement(event) {
    // Start from the event target
    let currentElement = event.target;

    // Traverse the DOM upwards and then search for siblings
    while (currentElement) {
        let sibling = currentElement.nextElementSibling;

        while (sibling) {
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

function captureElementM(event) {
    // Start from the event target
    let currentElement = event.target;

    // Traverse the DOM upwards and then search for siblings
    while (currentElement) {
        let sibling = currentElement.nextElementSibling;

        while (sibling) {
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

function downloadAll(event) {
    event.preventDefault();

    const shoppingCartDiv = document.getElementById('shopping-cart-div');
    const rows = shoppingCartDiv ? shoppingCartDiv.querySelectorAll('table tr') : [];

    const tableCheckboxStatuses = [];
    const tableDropdownValues = [];
    const tableLinkParams = [];
    const nt = [];

    rows.forEach(row => {
        // Get the values of multi-select dropdowns in the first cell
        const firstColumn = row.querySelectorAll('td').item(0);
        if (firstColumn) {
            const dropdowns = firstColumn.querySelectorAll('select');
            const dropdownValues = Array.from(dropdowns).map(dropdown => {
                return Array.from(dropdown.selectedOptions).map(option => option.value);
            });
            tableDropdownValues.push(dropdownValues);

            // Get the value of the link's href and parse it for var and sheet parameters
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

        // Get the checkbox status in the last cell
        const lastColumn = row.querySelectorAll('td').item(2);
        if (lastColumn) {
            const checkboxes = lastColumn.querySelectorAll('input[type="checkbox"]');
            const checkboxStatuses = Array.from(checkboxes).map(checkbox => checkbox.checked);
            tableCheckboxStatuses.push(checkboxStatuses);
        }

        let lp;
        try {
            lp = row.querySelectorAll('td').item(0).querySelector("div").querySelectorAll("*:not(option)");
        } catch (error) {
            lp = row.querySelectorAll('td').item(0).querySelectorAll("*:not(option)");
        }
        nt.push([]);
        lp.forEach((link) => {
            if (link.classList.contains("broken")) {
                nt[nt.length - 1].push(link.innerHTML);
            } else {
                nt[nt.length - 1].push("");
            }
        });
    });

    let tableData = {
        checkboxes: tableCheckboxStatuses,
        dropdowns: tableDropdownValues,
        links: tableLinkParams,
        whatever: nt
    };

    for (let i = 0; i < tableData.links.length; i++) {
        let data = {
            checkboxes: [tableData.checkboxes[i]],
            dropdowns: [tableData.dropdowns[i]],
            links: [tableData.links[i]],
            whatever: [tableData.whatever[i]]
        }
        if (data.dropdowns.length != 0) {
            let con = false;
            data.dropdowns[0].forEach((dropdown, index) => {
                if (dropdown.length == 0) {
                   con = true;
                }
            });
            if (con) {
                continue;
            }
        }
        let varNames = [];

    function generateCombinations(dropdowns, varNames, index) {
        varNames = [...varNames];
        if (index === dropdowns.length) {
            return varNames;
        }

        if (index == 0) {
            for (let option of dropdowns[index]) {
                varNames.push(option);
            }
            return generateCombinations(dropdowns, varNames, index + 1);
        } else {
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

    varNames = generateCombinations(data.dropdowns[0], [], 0);
      
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
      if (varNames.length == 0) {
        varNames = [data.links[0].var];
      }

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
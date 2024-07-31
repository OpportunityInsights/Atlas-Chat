import ollama

def get_current_status(status):
    # Dummy implementation of status fetching
    # Replace this with actual logic to get the status data
    return f"The weather in {status} is 70 degrees fahrenheit and sunny."

messages = []  # Ensure this is a list

def chat():
    while True:
        user_input = input("Enter your message: ")
        messages.append({'role': 'user', 'content': user_input})
        response = ollama.chat(
            model='llama3.1',
            messages=messages,
            tools=[{
                'type': 'function',
                'function': {
                    'name': 'get_current_weather',
                    'description': 'Get the current weather for a city',
                    'parameters': {
                        'type': 'object',
                        'properties': {
                            'city': {
                                'type': 'string',
                                'description': 'The name of the city',
                            },
                        },
                        'required': ['city'],
                    },
                },
            },
            {
                'type': 'function',
                'function': {
                    'name': 'respond',
                    'description': 'Text in this function is sent to the user',
                    'parameters': {
                        'type': 'object',
                        'properties': {
                            'response': {
                                'type': 'string',
                                'description': 'Your response to the user',
                            },
                        },
                        'required': ['response'],
                    },
                },
            }]
        )

        # Ensure response['message'] is a dictionary
        if isinstance(response, dict) and 'message' in response:
            tool_calls = response['message'].get('tool_calls', [])
            for tool_call in tool_calls:
                function_info = tool_call.get('function', {})
                function_name = function_info.get('name')
                arguments = function_info.get('arguments', {})

                if function_name == 'get_current_weather':
                    status = arguments.get('city')
                    if status:
                        status_info = get_current_status(status)
                        print(status_info)
                        messages.append({'role': 'system', 'content': status_info})

                elif function_name == 'respond':
                    response_text = arguments.get('response')
                    if response_text:
                        print(response_text)
                        messages.append({'role': 'system', 'content': response_text})
                        
            # Print response content if no tool call is made
            if not tool_calls:
                print(response['message']['content'])
                messages.append({'role': 'system', 'content': response['message']['content']})


# Run the chat
chat()
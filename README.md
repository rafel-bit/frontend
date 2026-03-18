# Chat Application
Github Repository: https://github.com/rafel-bit/frontend.git

Note: Commits are pushed by another github account by the name of “BludDrip”. This account is my other account, and I forgot to change the git config to my “rafel-bit” account repository owner.

Welcome to the chat application project. This readme will explain how the project is organized and why. It will also overview the issues encountered during development whether that includes planning issues, bugs, or architectural faults.

## Code Structure
The code is organized to group common elements while also separating the difference in functionality. The entire code base is a frontend interface for users, with focus on communicating with the backend to retrieve data.

### Components
The components are a grouping made up of UI for presentation to the user. UI elements are separated into their own files to handle different areas of the chat application. The components consists of UI elements like:
        - Chatroom UI and presentation
        - Contact/active messenger lists
        - Login menu for new or returning users
        - Searching users
These represent the basic UI components of the frontend and are most likely what is noticed during use of the application. Frontend development was accomplished using React and the router to manage pages.

The bulk of the code lies in the components and is where unit testing is mainly prioritized. Jest framework was used for all tests and many frontend tests rely on simulated user actions and mock systems.

### Services
The service group is made for grouping the setup of certain backend communications. The app communicates with the backend to retrieve information from the database or handle authentication. The key setup initializes Axios and handles tokens, and errors the API may encounter. WebSockets are also initialized to connect, disconnect, and send and receive messages.

### Context
Context is small because it only handles the authorization endpoint communication. Everything from backend API creations, deletions, updates, and retrievals of user information related to login and signup.

## Challenges
This is a prominent topic that has presented itself throughout the development of the project. This project was almost entirely a new experience and required much external learning resources and assistance.AI was used throughout the development of the assignment to assist in creating a foundation for the project, as well as accomplishing testing and mundane tasks.

The core issue stemmed from a poorly planned database design. The endpoints were not suited for CRUD operations, which created issues throughout the entire project.

The whole thing led to an overambitious architecture which strayed from the original scope of the original project and a solo developer given the time constraints. The project was designed to include both fully custom backend and frontend. Without solid database foundation, this original goal became the cause of the problem.

The flawed architecture made several features either very difficult to implement or caused them to behave unexpectedly. Progress slowed as the scope of the issue became visible. Rather than continuing with a broken architecture, I made the decision to switch to frontend development entirely and produce something rather than nothing.

# MarketSimulator
A simple, real-time stock market simulator to practice trading stocks

## To Build and Run
### Dependencies
You'll need the following installed to get the app up and running (in parentheses are the versions I'm working with):
- Node.js (8.9.2)
- npm (5.6.0)
- Bower (1.8.2) [I know that bower is quite outdated, planning on migrating to yarn at some point]
- MongoDB (shell version 3.4.10)

Open up two command line tabs and enter the following commands:
In one tab, run ```mongod``` to fire up MongoDB
In the other tab, run the following:
```
  $ npm install --save
  $ bower install
  $ npm start
```

__Note__: You may need to run ```npm install -g bower``` for the ```bower install``` step to work.

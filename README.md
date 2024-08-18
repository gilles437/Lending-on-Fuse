# Lending and Borrowing on the Fuse Network - DApp

A simple lending Defi APP that allows users to deposit WETH and borrow USDC, using [supra oracles](https://supra.com/data/networks/fuse?version=1&nid=112&networkType=mainnet) to determine the price of the assets in the contracts. The smart contract has the following features:

- Users are be able to deposit WETH.
- Users are able to enable WETH as collateral for borrowing.
- Users are able to borrow USDC after enabling WETH as collateral, and up to 50% of the initial value deposited.
- Users are not able to borrow more than their max borrow amount.
- Users are able to repay their debt either fully or partially.
- Users are able to withdraw their WETH or collateral provided they have no debt.
- Admin is able to pause the contract.
- The smart contract provides a view function that returns account information which includes collateral amount, borrow amount, account health etc
- The smart contract implements a stable APY interest model for the borrowed USDC, users are charged interest over time, and first pay the accrued interests when they repay their debt.

## Technologies

- Open Zeppelin: The contract uses IERC20 of OpenZeppelin to create an instance of a token and it uses also the Ownable and ReentrancyGuard of the OpenZepppelin to ensure security of the contract.
- Supra Oracle : The contract uses the [Push Oracle](https://docs.supra.com/docs/data-feeds/decentralized) of Supra to fetch real time price feeds.
- Hardhat: Hardhat is the development environment, asset pipeline, and testing framework for developing smart contracts.
- Hardhat Network: Hardhat Network is used as blockchain for local testing and automatic testing.
- An integrated "Mock Price" interface that allows to run full tests with complex scenario with chai scripting, by just running ```npx hardhat test```.
- React: React 18 is the front end framework used to ensure flexible user interaction.
- Metamask.
- Switch network to Fuse button.
- web3.js, ethers to interact with the blockchain network.
- EVM compatible, as FUSE is an EVM compatible blockchain.

## Installation

The project is composed of two parts:
- The smart contracts. 
- The Front End.

### 1. Deploy Smart Contract

Start by compiling testing the smart contract:


 ```cd <project directory>```
 
 ```cp .env-example .env```  

Replace your wallet private key with the existing one in the .env file.

 ```cd ./lending-contracts```
 
 ```npm install```
 
 ```npx hardhat compile```

 If you want to run the smart contract tests, you will need to run the Hardhat network in a separate console. Open a new console and run:

 ```npx hardhat node```

 Back to your original console, run:
 
 ```npx hardhat test```

Once tests are successful, you can deploy the **Lending** smart contract:

Deploy on the fuse network (check hardhad.config.js if you want to configure another network):

```npx hardhat run scripts/deploy.js --network fuse```

copy the address provided in the result after **Lending contract deployed to**

Finally, verify the contract:

 ```npx hardhat verify --network fuse <the copied address> "0x28C3d1cD466Ba22f6cae51b1a4692a831696391A" "0x5622F6dC93e08a8b717B149677930C38d5d50682" "0x79E94008986d1635A2471e6d538967EBFE70A296" 10 false```

where:

- USDC_ADDRESS = 0x28C3d1cD466Ba22f6cae51b1a4692a831696391A on FUSE
- WETH_ADDRESS = 0x5622F6dC93e08a8b717B149677930C38d5d50682 on FUSE
- Supra address of FUSE: 0x79E94008986d1635A2471e6d538967EBFE70A296
- interest rate APY = 10%
- is Testing = false 

Upon success, you should see:

#### Successfully verified contract Lending on the block explorer.
#### https://explorer.fuse.io/address/0x7e1C8bBFAd6a01471706bB61491eDEBF51B8074B#code

If you want the smart contract to successfully allow USDC borrowing, you will need to send some [USDC](https://explorer.fuse.io/address/0x28C3d1cD466Ba22f6cae51b1a4692a831696391A) to the address of the deployed smart contract.
Use your preferred browser and send a few USDC cents to the smart contract address that was provided when you deployed the Lending smart contract.
You can withdraw at the end the USDC that you sent using the withdrawUSDC function that you can access from the [Fuse explorer](https://explorer.fuse.io/).

We're all set with the smart contract installation and configuration.

### 2. Install the front end

 ```cd <project directory>```
 
 ```cd ./lending-fe-dapp```

 Copy the newly generated smart contract **CONTRACT_ABI** and **CONTRACT_ADDRESS** in the App.js and ./abis/CONTRACT_ABI.json:

1. Open App.js and replace the **CONTRACT_ADDRESS** with the new deployed smart contract address.
2. Go to [Fuse explorer]() and paste the address of the new smart contract. Then go to the contract section and copy the ABI of the contract.
    Paste the ABI in the file ./abis/CONTRACT_ABI.json and Save the file.

 ```npm install```

In the project directory, you can then run:

 ```npm run start```

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

 ```npm run build```

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## Warning

This code was not audited therefore you need to be careful and use it at your own risk.

## Screenshot of the DApp

Congrats, once you've done all the steps, you should see the Lending Dapp on Fuse!

![alt text](https://github.com/gilles437/Lending-on-Fuse/blob/main/lending-fe-dapp/public/Screenshot%202024-08-18%20at%2021.25.47.png)




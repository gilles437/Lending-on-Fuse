/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Add this line to import dotenv

module.exports = {
    solidity: "0.8.24",
    paths: {
      sources: "./contracts",
      tests: "./test",
      cache: "./cache",
      artifacts: "./artifacts"
    },
    networks: {
      fuse: {
        url: "https://rpc.fuse.io/",
        accounts: [`${process.env.PK_CONTRACT_OWNER}`], // put dev menomonic or PK here
        gasPrice: 50000000000

      },
      spark: {
        url: "https://rpc.fusespark.io/",
        accounts: [`${process.env.PK_CONTRACT_OWNER}`] // put dev menomonic or PK here,
      },
    },
  etherscan: {
      apiKey: {
        fuse: "YOUR_KEY_IF_YOU_HAVE_ONE",
        spark: "YOUR_KEY_IF_YOU_HAVE_ONE"
      },
      customChains: [
        {
          network: "fuse",
          chainId: 122,
          urls: {
            apiURL: "https://explorer.fuse.io/api",
            browserURL: "https://explorer.fuse.io"
          }
        },
        {
          network: "spark",
          chainId: 123,
          urls: {
            apiURL: "https://explorer.fusespark.io/api",
            browserURL: "https://explorer.fusespark.io"
          }
        }
      ]
    },
    
  };
  
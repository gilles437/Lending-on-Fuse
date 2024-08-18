// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface ISupraSValueFeed {

// Data structure to hold the pair data
struct priceFeed {
    uint256 round;
    uint256 decimals;
    uint256 time;
    uint256 price;
    }

// Data structure to hold the derived/connverted data pairs.  This depends on your requirements.

struct derivedData{
    int256 roundDifference;
    uint256 derivedPrice;
    uint256 decimals;
}

function getSvalue(uint256 _pairIndex)
    external 
    view
    returns (priceFeed memory);

function getSvalues(uint256[] memory _pairIndexes)
    external
    view
    returns (priceFeed[] memory);

function getDerivedSvalue(uint256 pair_id_1,uint256 pair_id_2,
    uint256 operation)
    external
    view
    returns (derivedData memory);

function getTimestamp(uint256 _tradingPair) 
    external
    view
    returns (uint256);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ISupraSValueFeed.sol";


contract PriceFeedMock is ISupraSValueFeed {
    uint256 public constant ETH_USDT_VALUE = 2650; // ETH/USDC = 2650
    uint256 public constant USDC_USD_VALUE = 1; // ETH/USDC = 2650

    function getSvalue(uint256 _pairIndex) external view override returns (priceFeed memory)
    {
        // Mocking price  values
        priceFeed memory feed;
        if (_pairIndex == 46) {
            feed.price = ETH_USDT_VALUE * 1e18;
        }
        //USDC_USD supra oracles gives 100_000_000 for 1 USDC
        else if (_pairIndex == 89) {
            feed.price = USDC_USD_VALUE * 100 * 1e6;
        } 
        else {
            feed.price = 1 * 1e18;
        }
        
        //feed.price = _pairIndex == 46 ? ETH_USDT_VALUE * 1e18 : 1 * 1e18; // e.g., ETH/USDC = 2650
        return feed;
    }

    //pair id = 46 for eth_usdc
    function getSvalues(uint256[] memory _pairIndexes) external view override returns (priceFeed[] memory)
    {
        priceFeed[] memory feeds = new priceFeed[](_pairIndexes.length);
        for (uint256 i = 0; i < _pairIndexes.length; i++) {

            if (_pairIndexes[i] == 46) {
                feeds[i].price = ETH_USDT_VALUE * 1e18;
            }
            //USDC_USD supra oracles gives 100_000_000 for 1 USDC
            else if (_pairIndexes[i] == 89) {
                feeds[i].price = USDC_USD_VALUE * 100 * 1e6;
            } 
            else {
                feeds[i].price = 1 * 1e18;
            }

            //feeds[i].price = _pairIndexes[i] == 46 ? ETH_USDT_VALUE * 1e18 : 1 * 1e18; // e.g., ETH/USDC = 2650
        }
        return feeds;
    }
    //pair id = 46 for eth_usdc
    function getDerivedSvalue(uint256 pair_id_1, uint256 pair_id_2, uint256 operation) external view override returns (derivedData memory)
    {
        derivedData memory data;

         if (pair_id_1 == 46) {
                data.derivedPrice = ETH_USDT_VALUE * 1e18;
            }
            //USDC_USD supra oracles gives 100_000_000 for 1 USDC
            else if (pair_id_1 == 89) {
                data.derivedPrice = USDC_USD_VALUE * 100 * 1e6;
            } 
            else {
                data.derivedPrice = 1 * 1e18;
            }

        //data.derivedPrice = (pair_id_1 == 46 ? ETH_USDT_VALUE * 1e18 : 1 * 1e18);
        return data;
    }

    function getTimestamp(uint256 _tradingPair) external view override returns (uint256)
    {
        return block.timestamp;
    }
}

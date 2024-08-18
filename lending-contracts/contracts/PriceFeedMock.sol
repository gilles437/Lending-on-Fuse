// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ISupraSValueFeed.sol";

contract PriceFeedMock is ISupraSValueFeed {
    function getSvalue(uint256 _pairIndex) external view override returns (priceFeed memory)
    {
        // Mocking price  values
        priceFeed memory feed;
        // replace eth value with 2650 if needed
        feed.price = _pairIndex == 46 ? 2650 * 1e18 : 1 * 1e18; // e.g., ETH/USDC = 2650
        return feed;
    }

    //pair id = 46 for eth_usdc
    function getSvalues(uint256[] memory _pairIndexes) external view override returns (priceFeed[] memory)
    {
        priceFeed[] memory feeds = new priceFeed[](_pairIndexes.length);
        for (uint256 i = 0; i < _pairIndexes.length; i++) {
            feeds[i].price = _pairIndexes[i] == 46 ? 2650 * 1e18 : 1 * 1e18; // e.g., ETH/USDC = 2650
        }
        return feeds;
    }
    //pair id = 46 for eth_usdc
    function getDerivedSvalue(uint256 pair_id_1, uint256 pair_id_2, uint256 operation) external view override returns (derivedData memory)
    {
        derivedData memory data;
        data.derivedPrice = (pair_id_1 == 46 ? 2650 * 1e18 : 1 * 1e18);
        return data;
    }

    function getTimestamp(uint256 _tradingPair) external view override returns (uint256)
    {
        return block.timestamp;
    }
}

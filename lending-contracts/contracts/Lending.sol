// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/ISupraSValueFeed.sol";

import "./MyFixedSupplyToken.sol";
import "./PriceFeedMock.sol";  

contract Lending is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public usdcToken; // USDC  token contract.
    IERC20 public wethToken; // WETH token contract
    uint256 public interestRate; // in basis points, e.g. 500 = 5%

    uint256 public constant SECONDS_IN_YEAR = 31536000; // Seconds in a year
    uint256 public constant GRACE_THRESHOLD = 1e2; //or 0.00001 USDC 

    uint256 private  perSecondRate;
    uint256 public liquidationThreshold = 50; // Liquidation threshold in percentage (50%)

    struct Borrow {
        uint256 principal;
        uint256 userLastTimestamp;
        uint256 accruedInterest;
    }

    mapping(address => Borrow) public userBorrowData;

    struct Account {
        uint256 collateralAmount; // WETH collateral
        bool isCollateralEnabled;
        uint256 maxBorrow;
    }

    ISupraSValueFeed internal sValueFeed;
    PriceFeedMock internal priceFeed;

    mapping(address => Account) public accounts;

    event CollateralDeposited(address indexed user, uint256 amount);
    event USDCBorrowed(address indexed user, uint256 amount);
    event USDCRepaid(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event CollateralEnabled(address indexed user);
    event CollateralDisabled(address indexed user);
    event Liquidation(address indexed liquidator, address indexed borrower, uint256 repayAmount, uint256 collateralSeized);

    event Paused(address indexed admin);
    event Unpaused(address indexed admin);

    bool private _paused;

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "Contract is not paused");
        _;
    }

    constructor(address _usdcToken, address _wethToken, address _sValueFeed,uint256 _interestRate, bool isTesting) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
        wethToken = IERC20(_wethToken);
        interestRate = _interestRate;
        uint256 adjustedInterestRate = (_interestRate * 1e18) / (100 * 100);  // representing 0.05 for 5% or interestRate = 500
        perSecondRate = adjustedInterestRate / SECONDS_IN_YEAR;
        console.log('perSecondRate',perSecondRate, 'interestRate',interestRate);
        if (isTesting == true) {
            sValueFeed = PriceFeedMock(_sValueFeed);
        }
        else {
            sValueFeed = ISupraSValueFeed(_sValueFeed);
        }
    }

    function getPrice(uint256 _priceIndex) public view returns (ISupraSValueFeed.priceFeed memory) {
        return sValueFeed.getSvalue(_priceIndex);
    }

    // Deposit WETH as collateral 
    function deposit(uint256 _amount) external whenNotPaused nonReentrant {
        Account storage account = accounts[msg.sender];

        require(_amount > 0, "The Collateral amount must be greater than 0.");
        // Update user's collateral balance
        accounts[msg.sender].collateralAmount += _amount;
        account.maxBorrow = calculateMaxBorrow(msg.sender);

        // Transfer WETH from user to the contract
        wethToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit CollateralDeposited(msg.sender, _amount);
    }

    function enableCollateral() external whenNotPaused {
        require(accounts[msg.sender].collateralAmount > 0, "No collateral deposited");
        accounts[msg.sender].isCollateralEnabled = true;
        emit CollateralEnabled(msg.sender);
    }

    function disableCollateral() external whenNotPaused {
        require(userBorrowData[msg.sender].principal == 0, "Cannot disable Collateral with outstanding debt");
        accounts[msg.sender].isCollateralEnabled = false;
        emit CollateralDisabled(msg.sender);
    }

   function updateAccountAndBorrowState(address user) internal {
        Borrow storage userBorrow = userBorrowData[user];
        Account storage account = accounts[user];

        if (userBorrow.principal > 0) {
            uint256 timeElapsed = block.timestamp - userBorrow.userLastTimestamp;
            userBorrow.accruedInterest += (userBorrow.principal * perSecondRate * timeElapsed) / 1e18;
        }

        account.maxBorrow = calculateMaxBorrow(user);
        userBorrow.userLastTimestamp = block.timestamp;
    }

   function updateAccountState(address user) internal {
        Account storage account = accounts[user];
        account.maxBorrow = calculateMaxBorrow(user);
    }

    function borrow(uint256 amount) external whenNotPaused nonReentrant {
        updateAccountAndBorrowState(msg.sender);

        Account storage account = accounts[msg.sender];
        Borrow storage userBorrow = userBorrowData[msg.sender];

        require(account.isCollateralEnabled, "Collateral is not  enabled.");
        require(account.collateralAmount > 0, "Insufficient collateral");
        require(usdcToken.balanceOf(address(this)) >= amount, "Insufficient USDC liquidity");
        require(amount <= account.maxBorrow, "Borrow amount exceeds maximum allowed");

        userBorrow.principal += amount;
        userBorrow.userLastTimestamp = block.timestamp;
        account.maxBorrow = calculateMaxBorrow(msg.sender);

        require(usdcToken.transfer(msg.sender, amount), "USDC transfer failed");
        emit USDCBorrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external whenNotPaused nonReentrant {
        updateAccountAndBorrowState(msg.sender);

        require(amount > 0, "Repay amount must be greater than 0");

        Account storage account = accounts[msg.sender];
        Borrow storage userBorrow = userBorrowData[msg.sender];

        require((userBorrow.principal + userBorrow.accruedInterest) >= amount, "Repay amount exceeds debt");

        // If the repayment amount is larger than or equal to the accrued interest, pay off the interest first
        if (amount >= userBorrow.accruedInterest) {
            // Subtract the accrued interest from the repayment amount
            uint256 remainingAfterInterest = amount - userBorrow.accruedInterest;
            userBorrow.accruedInterest = 0;
            // Apply the remaining repayment to the principal
            userBorrow.principal = (userBorrow.principal >= remainingAfterInterest 
                ? userBorrow.principal - remainingAfterInterest 
                : 0);
        } else {
            // If the repayment amount is less than the accrued interest, reduce the accrued interest
            userBorrow.accruedInterest -= amount;
        }

        userBorrow.userLastTimestamp = block.timestamp;
        account.maxBorrow = calculateMaxBorrow(msg.sender);

        // If remaining debt is smaller than the grace threshold, consider it fully repaid
        if (userBorrow.principal + userBorrow.accruedInterest <= GRACE_THRESHOLD) {
            userBorrow.principal = 0;
            userBorrow.accruedInterest = 0;
        }

        // Transfer USDC from user to contract
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        emit USDCRepaid(msg.sender, amount);
    }

    function getDebtInfo(address borrower) external view returns (uint256 userLastTimestamp, uint256 principal, uint256 accruedInterest) {
        Borrow memory userBorrow = userBorrowData[borrower];
        uint256 timeElapsed = block.timestamp - userBorrow.userLastTimestamp;
        uint256 newInterest = (userBorrow.principal * perSecondRate * timeElapsed) / 1e18;
        
        return (userBorrow.userLastTimestamp, userBorrow.principal, userBorrow.accruedInterest + newInterest);
    }

    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        Account storage account = accounts[msg.sender];
        Borrow storage userBorrow = userBorrowData[msg.sender];
        require(userBorrow.principal == 0, "Cannot withdraw with outstanding debt");
        require(account.collateralAmount >= amount, "Insufficient collateral");
        account.collateralAmount -= amount;
        account.maxBorrow = calculateMaxBorrow(msg.sender);
        wethToken.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function pause() external onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function getCollateralValue(uint256 collateralAmount) public view returns (uint256) {
        uint256 ethPrice = getEthPrice();
        uint256 collateral = (collateralAmount / 1e18) * (ethPrice / 1e18);
        return collateral; // Convert back to USDC's 6 decimals
    }

    function calculateMaxBorrow(address user) public view returns (uint256) {
        Account storage account = accounts[user];
        Borrow memory userBorrow = userBorrowData[msg.sender];

        uint256 collateralValue = account.collateralAmount * (getEthPrice() / 1e18) * (getUsdcUsdPrice() / 1e6);
        // Calculate maximum borrowable amount as 50% of collateral value
        uint256 maxBorrowable = collateralValue / 2;

        uint256 debtIn18 = to18Decimals(userBorrow.principal, 6);
        // Ensure that existing debt is properly subtracted
        if (maxBorrowable <= debtIn18) {
            return 0; // No more borrowable amount if debt equals or exceeds max borrowable
        }
        return from18Decimals(maxBorrowable - debtIn18, 6); // Convert back to USDC's 6 decimals
    }

    // Liquidation function
    function liquidate(address borrower) external whenNotPaused nonReentrant {
        Account storage account = accounts[borrower];
        Borrow storage userBorrow = userBorrowData[borrower];

        require(userBorrow.principal > 0, "No debt to liquidate");

        uint256 collateralValue = (account.collateralAmount * getEthPrice() / 1e18) * (getUsdcUsdPrice() / 1e6);
        uint256 debtValue = to18Decimals(userBorrow.principal, 6);

        // Check if the collateral value is less than or equal to 50% of the debt value
        require(collateralValue * 100 <= debtValue * 2, "Collateral is above liquidation threshold");

        // Liquidate: Seize collateral and repay debt
        uint256 repayAmount = userBorrow.principal;
        uint256 collateralSeized = account.collateralAmount;

        // Update borrower account
        account.collateralAmount = 0;
        userBorrow.principal = 0;
        userBorrow.accruedInterest = 0;

        // Transfer USDC from liquidator to contract
        usdcToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        // Transfer collateral (WETH) from contract to liquidator
        wethToken.safeTransfer(msg.sender, collateralSeized);

        emit Liquidation(msg.sender, borrower, repayAmount, collateralSeized);
    }    

    function to18Decimals(uint256 amount, uint8 tokenDecimals) internal pure returns (uint256) {
        return amount * (10 ** (18 - tokenDecimals));
    }

    function from18Decimals(uint256 amount, uint8 tokenDecimals) internal pure returns (uint256) {
        return amount / (10 ** (18 - tokenDecimals));
    }

    function calculateHealthFactor(address user) public view returns (uint256) {
        Account storage account = accounts[user];
        Borrow memory userBorrow = userBorrowData[user];

        if (userBorrow.principal == 0) {
            return type(uint256).max; // No debt, max health
        }

        return (account.maxBorrow / to18Decimals(userBorrow.principal, 6)); // Health factor as a ratio.

    }

    function getAccountInfo(address user) public view returns (uint256 collateralAmount, uint256 debtAmount, bool isCollateralEnabled, uint256 ethPrice, uint256 collateralValue, uint256 maxBorrow, uint256 interRate) {
        Account storage account = accounts[user];
        Borrow memory userBorrow = userBorrowData[user];

        collateralAmount = account.collateralAmount;
        debtAmount = userBorrow.principal;
        isCollateralEnabled = account.isCollateralEnabled;
        ethPrice = getEthPrice();
        collateralValue = account.collateralAmount * (getEthPrice() / 1e18) * (getUsdcUsdPrice() / 1e6);
        maxBorrow = account.maxBorrow;
        interRate = interestRate;

    }

    function getEthPrice() public view returns (uint256) {
        //index 46 for pair eth_usdc
        //index 1 for pair eth_usdt
        uint256 ethOraclePrice = uint256(getPrice(46).price);
        return ethOraclePrice ; 

    }

    function getUsdcUsdPrice() public view returns (uint256) {
        //index 89 for pair usdc_usd
        uint256 ethOraclePrice = uint256(getPrice(89).price);
        return ethOraclePrice / 100; 
    }

    function withdrawUSDC(uint256 amount) external onlyOwner whenNotPaused nonReentrant {
        require(usdcToken.balanceOf(address(this)) >= amount, "Insufficient USDC balance in contract");
        usdcToken.transfer(msg.sender, amount);
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    receive() external payable {
        revert("Direct ETH deposits not allowed. Use deposit function.");
    }

}
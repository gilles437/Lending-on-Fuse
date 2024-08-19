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

    IERC20 public usdcToken; // USDC  token contract
    IERC20 public wethToken; // WETH token contract
    uint256 public interestRate; // in basis points, e.g., 500 = 5%

    uint256 public constant SECONDS_IN_YEAR = 31536000; // Seconds in a year
    uint256 private  perSecondRate;

    struct Borrow {
        uint256 principal;
        uint256 lastBorrowTime;
        uint256 accruedInterest;
    }
    mapping(address => Borrow) public borrowings;

    struct Account {
        uint256 collateralAmount; // WETH collateral
        uint256 debtAmount; // USDC debt
        uint256 ethPrice;
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
        perSecondRate = (interestRate * 1e18) / SECONDS_IN_YEAR;
       
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
        require(_amount > 0, "The Collateral amount must be greater than 0.");
        // Transfer WETH from user to the contract
        wethToken.safeTransferFrom(msg.sender, address(this), _amount);
        // Update user's collateral balance
        accounts[msg.sender].collateralAmount += _amount;
        calculateMaxBorrow(msg.sender);
        emit CollateralDeposited(msg.sender, _amount);
    }

    function enableCollateral() external whenNotPaused {
        require(accounts[msg.sender].collateralAmount > 0, "No collateral deposited");
        accounts[msg.sender].isCollateralEnabled = true;
        emit CollateralEnabled(msg.sender);
    }

    function disableCollateral() external whenNotPaused {
        require(accounts[msg.sender].debtAmount == 0, "Cannot disable Collateral with outstanding debt");
        accounts[msg.sender].isCollateralEnabled = false;
        emit CollateralDisabled(msg.sender);
    }

    function borrow(uint256 amount) external whenNotPaused nonReentrant {
        Account storage account = accounts[msg.sender];
        Borrow storage userBorrow = borrowings[msg.sender];

        require(account.isCollateralEnabled, "Collateral is not  enabled");
        require(account.collateralAmount > 0, "Insufficient collateral");
        // Calculate the max borrow amount
        uint256 maxBorrow = calculateMaxBorrow(msg.sender);
        // Convert the amount from 6 decimals to 18 decimals
        uint256 amountIn18Decimals = to18Decimals(amount, 6);
        // Compare the amount in 18 decimals with maxBorrow
        require(amountIn18Decimals <= maxBorrow, "Borrow amount exceeds maximum allowed");
        require(usdcToken.balanceOf(address(this)) >= amount, "Insufficient USDC liquidity");
        require(usdcToken.transfer(msg.sender, amount), "USDC transfer failed");

        account.debtAmount += amount;

        if (userBorrow.principal > 0) {
            uint256 timeElapsed = block.timestamp - userBorrow.lastBorrowTime;
            userBorrow.accruedInterest += (userBorrow.principal * perSecondRate * timeElapsed) / 1e18;
        }

        userBorrow.principal += amount;
        userBorrow.lastBorrowTime = block.timestamp;

        account.maxBorrow = calculateMaxBorrow(msg.sender);
        emit USDCBorrowed(msg.sender, amount);
    }

    function calculateAccruedInterest(Borrow storage userBorrow) internal view returns (uint256) {
        uint256 principalIn18 = to18Decimals(userBorrow.principal, 6);
        uint256 timeElapsed = block.timestamp - userBorrow.lastBorrowTime;
        uint256 newInterestIn18 = (principalIn18 * perSecondRate * timeElapsed) / 1e18;
        return from18Decimals(newInterestIn18, 6); // Convert back to USDC's 6 decimals
    }

    function repay(uint256 amount) external whenNotPaused nonReentrant {
        Account storage account = accounts[msg.sender];
        Borrow storage userBorrow = borrowings[msg.sender];

        require(amount > 0, "Repay amount must be greater than 0");
        require(account.debtAmount >= amount, "Repay amount exceeds debt");

        // Convert the repayment amount to 18 decimals for calculation
        uint256 amountIn18 = to18Decimals(amount, 6);
        // Transfer USDC from user to contract
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        // Update the user's debt
        account.debtAmount -= amount;
        // Calculate accrued interest with proper decimal handling
        uint256 newInterest = calculateAccruedInterest(userBorrow);
        userBorrow.accruedInterest += newInterest;

        if (amountIn18 >= userBorrow.accruedInterest) {
            uint256 remaining = amountIn18 - userBorrow.accruedInterest;
            userBorrow.principal -= from18Decimals(remaining, 6);
            userBorrow.accruedInterest = 0;
        } else {
            userBorrow.accruedInterest -= amountIn18;
        }

        userBorrow.lastBorrowTime = block.timestamp;
        calculateMaxBorrow(msg.sender);

        emit USDCRepaid(msg.sender, amount);
    }

    function getDebtInfo(address borrower) external view returns (uint256 lastBorrowTime, uint256 principal, uint256 accruedInterest) {
        Borrow memory userBorrow = borrowings[borrower];
        uint256 timeElapsed = block.timestamp - userBorrow.lastBorrowTime;
        uint256 newInterest = (userBorrow.principal * perSecondRate * timeElapsed) / 1e18;
        
        return (userBorrow.lastBorrowTime, userBorrow.principal, userBorrow.accruedInterest + newInterest);
    }

    function withdraw(uint256 amount) external whenNotPaused nonReentrant {
        Account storage account = accounts[msg.sender];
        require(account.debtAmount == 0, "Cannot withdraw with outstanding debt");
        require(account.collateralAmount >= amount, "Insufficient collateral");
        account.collateralAmount -= amount;
        wethToken.safeTransfer(msg.sender, amount);
        calculateMaxBorrow(msg.sender);
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

    function calculateMaxBorrow(address user) public  returns (uint256) {
        Account storage account = accounts[user];
        uint256 collateralValue = account.collateralAmount * getEthPrice() / 1e18 * (getUsdcUsdPrice() / 1e6);

        // Calculate maximum borrowable amount as 50% of collateral value
        uint256 maxBorrowable = collateralValue / 2;
        uint256 debtIn18 = to18Decimals(account.debtAmount, 6);
        // Ensure that existing debt is properly subtracted
        if (maxBorrowable <= debtIn18) {
            return 0; // No more borrowable amount if debt equals or exceeds max borrowable
        }

        account.maxBorrow = maxBorrowable - debtIn18;

        return (account.maxBorrow); // Subtract existing debt
    }

    function to18Decimals(uint256 amount, uint8 tokenDecimals) internal pure returns (uint256) {
        return amount * (10 ** (18 - tokenDecimals));
    }

    function from18Decimals(uint256 amount, uint8 tokenDecimals) internal pure returns (uint256) {
        return amount / (10 ** (18 - tokenDecimals));
    }

    function calculateHealthFactor(address user) public view returns (uint256) {
        Account storage account = accounts[user];
        if (account.debtAmount == 0) {
            return type(uint256).max; // No debt, max health
        }

        return (account.maxBorrow / to18Decimals(account.debtAmount, 6)); // Health factor as a ratio.

    }

    function getAccountInfo(address user) public view returns (uint256 collateralAmount, uint256 debtAmount, bool isCollateralEnabled, uint256 ethPrice, uint256 collateralValue, uint256 maxBorrow, uint256 interRate) {
        Account storage account = accounts[user];
        collateralAmount = account.collateralAmount;
        debtAmount = account.debtAmount;
        isCollateralEnabled = account.isCollateralEnabled;
        ethPrice = getEthPrice();
        collateralValue = account.collateralAmount * (getEthPrice() / 1e18) * (getUsdcUsdPrice() / 1e6);
        console.log('getUsdcUsdPrice', getUsdcUsdPrice());
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
        //index 89 for pair eth_usdt
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

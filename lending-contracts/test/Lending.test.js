
const { expect } = require("chai");
const { ethers } = require("hardhat");

const ETH_USD_PRICE = 2650
const BORROW_PERCENTAGE = 0.5
describe("Lending Contract", function () {
    let lending, usdcToken, wethToken;
    let owner, addr1, addr2;
    let usdcAddress, wethAddress, priceFeedMockAddress, lendingAddress;


    beforeEach(async function () {
      [owner, addr1, addr2] = await ethers.getSigners();

      // Deploy the USDC and WETH tokens
      const Token = await ethers.getContractFactory("MyFixedSupplyToken");
      usdcToken = await Token.deploy("USD Coin", "USDC", ethers.parseEther("1000000000000"), owner.address);
      const transactionReceipt1 = await usdcToken.deploymentTransaction().wait(1);
       usdcAddress = await transactionReceipt1.contractAddress;

      wethToken = await Token.deploy("Wrapped Ether", "WETH", ethers.parseEther("1000000000000"), owner.address);
      const transactionReceipt2 = await wethToken.deploymentTransaction().wait(1);
       wethAddress = await transactionReceipt2.contractAddress;

      // Deploy the price feed mock
      const PriceFeedMock = await ethers.getContractFactory("PriceFeedMock");
      const priceFeedMock = await PriceFeedMock.deploy();
      const transactionReceipt3 = await priceFeedMock.deploymentTransaction().wait(1);
       priceFeedMockAddress = await transactionReceipt3.contractAddress;

      // Deploy the lending contract
      const Lending = await ethers.getContractFactory("Lending");
      lending = await Lending.deploy( usdcAddress,  wethAddress,  priceFeedMockAddress, 100000000000, true); // Interest rate of 5%
      const transactionReceipt4 = await lending.deploymentTransaction().wait(1);
      lendingAddress = await transactionReceipt4.contractAddress;

      // Transfer tokens to addr1
      const transferAmount = ethers.parseEther("1000"); // Amount to transfer

      // Transfer USDC and WETH from owner to addr1
      await wethToken.connect(owner).transfer(addr1.address, transferAmount);

      // Send USDC to Lending contract
      const usdcToLendingAmount = ethers.parseUnits("500", 6); // Amount of USDC to send to Lending contract
      await usdcToken.connect(owner).transfer(lendingAddress, usdcToLendingAmount);

    });


    it("Should allow users to deposit WETH as collateral", async function () {
      const depositAmount = ethers.parseEther("1"); // 0.1 WETH

      console.log("Initial WETH balance of addr1:", await wethToken.balanceOf(addr1.address));
      console.log("Initial USDC balance of addr1:", await usdcToken.balanceOf(addr1.address));


      await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
      console.log('approved ok')
      await lending.connect(addr1).deposit(depositAmount);

      const account = await lending.getAccountInfo(addr1.address);
      expect(account.collateralAmount).to.equal(depositAmount);
  });
  
  it("Should allow users to borrow USDC against their WETH collateral", async function () {
        const depositAmount = ethers.parseUnits("0.1", 18); // 0.1 WETH

        const wethPriceInUSDC = ETH_USD_PRICE * 1e6; // 1 WETH = ETH_USD_PRICE USDC, scaled to 6 decimals
        const borrowPercentage = BORROW_PERCENTAGE; // 0.5 is 50% of WETH value in USDC

        // Calculate the expected borrow amount
        const depositAmountInUnits = ethers.formatUnits(depositAmount, 18); // Convert to units (1 WETH = 1 ETH)
        const expectedBorrowAmount = ethers.parseUnits((depositAmountInUnits * (wethPriceInUSDC / 1e6) * borrowPercentage).toString(), 6);

        console.log('Deposit Amount:', depositAmount.toString());
        console.log('Expected Borrow Amount:', expectedBorrowAmount.toString());

        await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
        await lending.connect(addr1).deposit(depositAmount);
        await lending.connect(addr1).enableCollateral();
        await lending.connect(addr1).borrow(expectedBorrowAmount);

        const account = await lending.getAccountInfo(addr1.address);
        console.log('Health Factor:', account.healthFactor.toString());

        console.log('Debt Amount:', account.debtAmount.toString());

        expect(account.debtAmount).to.equal(expectedBorrowAmount);

        const usdcBalance = await usdcToken.balanceOf(addr1.address);
        console.log('USDC Balance of addr1:', usdcBalance.toString());
        expect(usdcBalance).to.equal(expectedBorrowAmount);
    });

    it("Should not allow users to borrow more than the maximum allowed", async function () {
      const depositAmount = ethers.parseUnits("0.1", 18); // 0.1 WETH
  
      // Assuming the WETH price is ETH_USD_PRICE USDC (scaled to 6 decimals)
      const wethPriceInUSDC = ETH_USD_PRICE * 1e6; // 1 WETH = ETH_USD_PRICE USDC, scaled to 6 decimals
      const borrowPercentage = BORROW_PERCENTAGE; // 0.5 is 50% of WETH value in USDC
  
      // Calculate the maximum allowed borrow amount
      const depositAmountInUnits = ethers.formatUnits(depositAmount, 18); // Convert WETH amount to units
      const maxBorrowAmount = ethers.parseUnits((depositAmountInUnits * (wethPriceInUSDC / 1e6) * borrowPercentage).toString(), 6);
  
      console.log('maxBorrowAmount', maxBorrowAmount)
      // Attempting to borrow more than the maximum allowed
      const excessiveBorrowAmount = maxBorrowAmount + ethers.parseUnits("1", 6); // Trying to borrow slightly more than the max allowed
      console.log('excessiveBorrowAmount',excessiveBorrowAmount)
       await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
       await lending.connect(addr1).deposit(depositAmount);
       await lending.connect(addr1).enableCollateral();
  
       await expect(lending.connect(addr1).borrow(excessiveBorrowAmount)).to.be.revertedWith("Borrow amount exceeds maximum allowed");
  });
  
  it("Should allow users to repay their USDC debt", async function () {
    const depositAmount = ethers.parseUnits("0.1", 18); // 0.1 WETH (18 decimals)

    // Assuming 1 WETH = ETH_USD_PRICE USDC (scaled to 6 decimals)
    const wethPriceInUSDC = ETH_USD_PRICE * 1e6; // ETH_USD_PRICE USDC with 6 decimals
    const borrowPercentage = BORROW_PERCENTAGE; // 0.5 is 50% of WETH value in USDC

    // Calculate the borrow amount based on the deposit amount
    const depositAmountInUnits = ethers.formatUnits(depositAmount, 18); // Convert WETH amount to a number
    const borrowAmount = ethers.parseUnits((depositAmountInUnits * (wethPriceInUSDC / 1e6) * borrowPercentage).toString(), 6); // Convert to USDC units

    await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
    await lending.connect(addr1).deposit(depositAmount);
    await lending.connect(addr1).enableCollateral();

    await lending.connect(addr1).borrow(borrowAmount);

    // Ensure addr1 has USDC to repay the debt
    await usdcToken.connect(owner).transfer(addr1.address, borrowAmount);

    await usdcToken.connect(addr1).approve(lendingAddress, borrowAmount);
    await lending.connect(addr1).repay(borrowAmount);

    const account = await lending.getAccountInfo(addr1.address);
    expect(account.debtAmount).to.equal(0);
  });

});

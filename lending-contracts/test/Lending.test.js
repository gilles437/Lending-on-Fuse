
const { expect } = require("chai");
const { ethers } = require("hardhat");

const ETH_USD_PRICE = 2650
const BORROW_PERCENTAGE = 0.5
const INTEREST_RATE = 10000 // 10000 = 100%
const EPSILON_AMOUNT = 0.000001

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
      lending = await Lending.deploy( usdcAddress,  wethAddress,  priceFeedMockAddress, INTEREST_RATE, true); // Interest rate of 5%
      const transactionReceipt4 = await lending.deploymentTransaction().wait(1);
      lendingAddress = await transactionReceipt4.contractAddress;

      // Transfer tokens to addr1
      const transferAmount = ethers.parseEther("1000"); // Amount to transfer

      // Transfer USDC and WETH from owner to addr1
      await wethToken.connect(owner).transfer(addr1.address, transferAmount);

      // Send USDC to Lending contract
      const usdcToLendingAmount = ethers.parseUnits("5000", 6); // Amount of USDC to send to Lending contract
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

    console.log('depositAmountInUnits', depositAmountInUnits, 'borrowAmount', borrowAmount)
    await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
    await lending.connect(addr1).deposit(depositAmount);
    await lending.connect(addr1).enableCollateral();

    await lending.connect(addr1).borrow(borrowAmount);

    // Ensure addr1 has USDC to repay the debt
    await usdcToken.connect(owner).transfer(addr1.address, borrowAmount);

    await usdcToken.connect(addr1).approve(lendingAddress, borrowAmount);
    await lending.connect(addr1).repay(borrowAmount);


    const account = await lending.getAccountInfo(addr1.address);
    const debt = await lending.getDebtInfo(addr1.address);
    console.log('debt.principal', debt.principal)
    expect(Number(ethers.formatUnits(debt.principal, 18))).to.lte(EPSILON_AMOUNT);
  });

  it("Should allow users to repay partially their USDC debt", async function () {
    const depositAmount = ethers.parseUnits("0.1", 18); // 0.1 WETH (18 decimals)

    // Assuming 1 WETH = ETH_USD_PRICE USDC (scaled to 6 decimals)
    const wethPriceInUSDC = ETH_USD_PRICE * 1e6; // ETH_USD_PRICE USDC with 6 decimals
    const borrowPercentage = BORROW_PERCENTAGE; // 0.5 is 50% of WETH value in USDC

    // Calculate the borrow amount based on the deposit amount
    const depositAmountInUnits = ethers.formatUnits(depositAmount, 18); // Convert WETH amount to a number
    const borrowAmount = ethers.parseUnits((depositAmountInUnits * (wethPriceInUSDC / 1e6) * borrowPercentage).toString(), 6); // Convert to USDC units

    console.log('depositAmountInUnits', depositAmountInUnits, 'borrowAmount', borrowAmount)
    await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
    await lending.connect(addr1).deposit(depositAmount);
    await lending.connect(addr1).enableCollateral();

    await lending.connect(addr1).borrow(borrowAmount);

    // Ensure addr1 has USDC to repay the debt
    await usdcToken.connect(owner).transfer(addr1.address, borrowAmount);

    const repayAmount = Number(Number(borrowAmount) / 2);
    await usdcToken.connect(addr1).approve(lendingAddress, repayAmount);
    await lending.connect(addr1).repay(repayAmount);

    const account = await lending.getAccountInfo(addr1.address);
    const debt = await lending.getDebtInfo(addr1.address);
    console.log('debt.principal', debt.principal)
    expect(Number(ethers.formatUnits(Number(debt.principal) / 2), 18)).to.lte(EPSILON_AMOUNT);
  });


// // Additional test for accrued interest with real-time 15 seconds delay
// it("Should calculate and accrue interest correctly after a real-time 15 seconds delay", async function () {
//   const depositAmount = ethers.parseUnits("1", 18); // 1 WETH
//   const borrowAmount = ethers.parseUnits("1000", 6); // 1000 USDC

//   await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
//   await lending.connect(addr1).deposit(depositAmount);
//   await lending.connect(addr1).enableCollateral();
//   await lending.connect(addr1).borrow(borrowAmount);

//   const accountBefore15Seconds = await lending.getAccountInfo(addr1.address);

//   // Wait for 15 real-time seconds
//   console.log("Waiting for 15 seconds...");
//   await new Promise(resolve => setTimeout(resolve, 15000)); // Sleep for 15 seconds

//   const accountAfter15Seconds = await lending.getAccountInfo(addr1.address);

//   // Calculate expected debt after 15 seconds
//   const interestRatePerSecond = INTEREST_RATE / (365 * 24 * 3600); // 5% annual interest rate converted to per second
//   const expectedDebtAfter15Seconds = Number(Number(borrowAmount) * (1 + (parseFloat(interestRatePerSecond) * 15)));

//   console.log('Debt Amount before 15 Seconds:', accountBefore15Seconds.ac);
//   console.log('Debt Amount After 15 Seconds:', accountAfter15Seconds.debtAmount.toString());
//   console.log('Expected Debt After 15 Seconds:', expectedDebtAfter15Seconds.toString());


//   expect(accountAfter15Seconds.debtAmount).to.be.closeTo(expectedDebtAfter15Seconds, ethers.parseUnits("0.01", 6)); // Allowing a small margin for precision

//   // Repay debt after interest accrual
//   await usdcToken.connect(owner).transfer(addr1.address, expectedDebtAfter15Seconds);
//   await usdcToken.connect(addr1).approve(lendingAddress, expectedDebtAfter15Seconds);
//   await lending.connect(addr1).repay(expectedDebtAfter15Seconds);

//   const accountAfterRepayment = await lending.getAccountInfo(addr1.address);
//   expect(accountAfterRepayment.debtAmount).to.equal(0);
// });


// // Additional test for accrued interest with real-time 15 seconds delay
// it("Should calculate and accrue interest correctly after a real-time 15 seconds delay", async function () {
//   const depositAmount = ethers.parseUnits("1", 18); // 1 WETH
//   const borrowAmount = ethers.parseUnits("1000", 6); // 1000 USDC

//   await wethToken.connect(addr1).approve(lendingAddress, depositAmount);
//   await lending.connect(addr1).deposit(depositAmount);
//   await lending.connect(addr1).enableCollateral();
//   await lending.connect(addr1).borrow(borrowAmount);

//   // Get debt info before the delay
//   const debtInfoBefore = await lending.getDebtInfo(addr1.address);
//   const initialPrincipalDebt = debtInfoBefore.principal;
//   const initialAccruedInterest = debtInfoBefore.accruedInterest;

//   console.log("Initial Principal Debt:", initialPrincipalDebt);
//   console.log("Initial Accrued Interest:", initialAccruedInterest);

//   // Wait for 15 real-time seconds
//   console.log("Waiting for 15 seconds...");
//   await new Promise(resolve => setTimeout(resolve, 15000)); // Sleep for 15 seconds

//   // Get debt info after the 15-second delay
//   const debtInfoAfter = await lending.getDebtInfo(addr1.address);
//   const newAccruedInterest = Number(debtInfoAfter.accruedInterest);

//   // Calculate expected accrued interest after 15 seconds
//   const interestRatePerSecond = INTEREST_RATE / (365 * 24 * 3600); // 5% annual interest rate converted to per second
//   const accruedInterestOver15Seconds = Number(initialPrincipalDebt) * interestRatePerSecond * 15;
//   const expectedAccruedInterest = Number(Number(initialAccruedInterest) + accruedInterestOver15Seconds);
//   const expectedTotalDebtAfter15Seconds = Number(initialPrincipalDebt) + expectedAccruedInterest;

//   console.log("Accrued Interest After 15 Seconds:", newAccruedInterest);
//   console.log("Expected Accrued Interest After 15 Seconds:", expectedAccruedInterest);
//   console.log("Total Debt Amount After 15 Seconds:", debtInfoAfter.totalDebtAmount);
//   console.log("Expected Total Debt After 15 Seconds:", expectedTotalDebtAfter15Seconds);

//   // Verify that the accrued interest and total debt are close to the expected values
//   expect(debtInfoAfter.accruedInterest).to.be.closeTo(ethers.parseUnits(expectedAccruedInterest, 6), ethers.parseUnits("0.01", 6));
//   expect(debtInfoAfter.totalDebtAmount).to.be.closeTo(ethers.parseUnits(expectedTotalDebtAfter15Seconds.toString(), 6), ethers.parseUnits("0.01", 6));

//   // Repay debt after interest accrual
//   await usdcToken.connect(owner).transfer(addr1.address, expectedTotalDebtAfter15Seconds);
//   await usdcToken.connect(addr1).approve(lendingAddress, expectedTotalDebtAfter15Seconds);
//   await lending.connect(addr1).repay(expectedTotalDebtAfter15Seconds);

//   const accountAfterRepayment = await lending.getAccountInfo(addr1.address);
//   expect(accountAfterRepayment.debtAmount).to.equal(0);
// });

});




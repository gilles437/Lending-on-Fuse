
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
   
    const USDC_ADDRESS = "0x28C3d1cD466Ba22f6cae51b1a4692a831696391A"; //   USDC token contract address
    const WETH_ADDRESS = "0x5622F6dC93e08a8b717B149677930C38d5d50682"; // Weth contract address
    const ORACLE_ADDRESS = "0x79E94008986d1635A2471e6d538967EBFE70A296"; //  Oracle contract address
    //interest rate 1000 = 10%
    const INTEREST_RATE = 1000

    const Lending = await ethers.getContractFactory("Lending");
    const lending = await Lending.deploy(USDC_ADDRESS, WETH_ADDRESS, ORACLE_ADDRESS, INTEREST_RATE , false);

    console.log("Lending contract deployed to:", await lending.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

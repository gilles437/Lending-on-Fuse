import Web3 from 'web3';
import WETH_ABI from './abis/WETH_ABI.json'
import USDC_ABI from './abis/USDC_ABI.json'
import WORKING_CONTRACT_ABI from './abis/CONTRACT_ABI.json'

const  { REACT_APP_WETH_CONTRACT_ADDRESS, REACT_APP_CONTRACT_ADDRESS} = process.env
const CONTRACT_ABI = WORKING_CONTRACT_ABI; 
const WETH_CONTRACT_ABI = WETH_ABI;

const loadContractData = async (
  web3,
  account,
  setContract,
  setCollateral,
  setInterestRate,
  setMaxBorrow,
  setCollateralPriceUSD,
  setDebt,
  setHealthFactor,
  setCollateralEnabled,
  setWethBalance,
  setWethBalancePriceUSD,
  setPaused,
  setIsOwner,
  fetchUsdcBalance,
  setError
) => {
  try {
    const contractInstance = new web3.eth.Contract(CONTRACT_ABI, REACT_APP_CONTRACT_ADDRESS);
    setContract(contractInstance);

    const accountInfo = await contractInstance.methods.getAccountInfo(account).call();
    const debtInfo = await contractInstance.methods.getDebtInfo(account).call();

    setCollateral(accountInfo.collateralAmount);
    setInterestRate(Number(accountInfo.interRate) / 100);
    setMaxBorrow(Number(accountInfo.maxBorrow));
    const collateralPriceInUSD = web3.utils.fromWei(accountInfo.collateralAmount, 'ether') * web3.utils.fromWei(accountInfo.ethPrice, 'ether');
    setCollateralPriceUSD(collateralPriceInUSD);
    const myDebt = parseFloat(web3.utils.fromWei(Number(debtInfo.principal), 'mwei')) + parseFloat(web3.utils.fromWei(Number(debtInfo.accruedInterest), 'mwei'));
    setDebt(debtInfo.principal + debtInfo.accruedInterest);

    if (Number(debtInfo.principal) === 0) {
      setHealthFactor((2 ** 256) - 1);
    } else {
      setHealthFactor(web3.utils.fromWei(Number(accountInfo.collateralValue), 'ether') / web3.utils.fromWei(Number(debtInfo.principal), 'mwei'));
    }

    setCollateralEnabled(accountInfo.isCollateralEnabled);
    const wethContract = new web3.eth.Contract(WETH_CONTRACT_ABI, REACT_APP_WETH_CONTRACT_ADDRESS);
    const balance = await wethContract.methods.balanceOf(account).call();
    setWethBalance(web3.utils.fromWei(balance, 'ether'));
    const wethBalanceInUsd = parseFloat(web3.utils.fromWei(balance, 'ether')) * web3.utils.fromWei(accountInfo.ethPrice, 'ether');
    setWethBalancePriceUSD(wethBalanceInUsd);

    const pausedState = await contractInstance.methods.paused().call();
    setPaused(pausedState);

    const ownerAddress = await contractInstance.methods.owner().call();
    setIsOwner(account.toLowerCase() === ownerAddress.toLowerCase());

    fetchUsdcBalance();

  } catch (err) {
    console.error("Error loading contract data:", err);
    setError("Failed to load contract data. Please try again.");
  }
};

export default loadContractData;

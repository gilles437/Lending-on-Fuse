import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import './App.css';

import fuseIcon from './images/fuse-icon.png';
import WETH_ABI from './abis/WETH_ABI.json'
import USDC_ABI from './abis/USDC_ABI.json'
import WORKING_CONTRACT_ABI from './abis/CONTRACT_ABI.json'

import BorrowDetails from './components/BorrowDetails'
import YourSupplies from './components/YourSupplies';
import YourBorrows from './components/YourBorrows';
import AssetsToSupply from './components/AssetsToSupply';
import AssetsToBorrow from './components/AssetsToBorrow';
  
import loadContractData from './utils/web3Service';
import { switchToFuseNetwork, connectWallet } from './utils/networkUtils'; 

const  { REACT_APP_WETH_CONTRACT_ADDRESS, REACT_APP_APY_ETH, REACT_APP_USDC_CONTRACT_ADDRESS, REACT_APP_CONTRACT_ADDRESS} = process.env
const CONTRACT_ABI = WORKING_CONTRACT_ABI; 
const WETH_CONTRACT_ABI = WETH_ABI;
const USDC_CONTRACT_ABI = USDC_ABI; 

function App() {
  const [account, setAccount] = useState(null);
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [wethContract, setWethContract] = useState(null);
  const [usdcContract, setUsdcContract] = useState(null);  
  const [collateral, setCollateral] = useState(0);
  const [debt, setDebt] = useState(0);
  const [healthFactor, setHealthFactor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [collateralEnabled, setCollateralEnabled] = useState(false);
  const [isWethApproved, setIsWethApproved] = useState(false);
  const [isUsdcApproved, setIsUsdcApproved] = useState(false);
  const [collateralPriceUSD, setCollateralPriceUSD] = useState(0);
  const [wethBalancePriceUSD, setWethBalancePriceUSD] = useState(0);
  const [wethBalance, setWethBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [isFuseNetwork, setIsFuseNetwork] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maxBorrow, setMaxBorrow] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (web3 && account) {
      setError(null); 
      loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
      listenToEvents();
      initializeContracts();
      
    }
  }, [web3, account]);

  useEffect(() => {
    const initializeWeb3 = async () => {
      if (window.ethereum) {
        try {
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);
          // Check the current network
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const isFuse = chainId === '0x7a'; // Fuse network chain ID
          setIsFuseNetwork(isFuse);
          if (isFuse) {
            initializeContracts(web3Instance);
          }
          // Handle network change
          window.ethereum.on('chainChanged', (chainId) => {
            setIsFuseNetwork(chainId === '0x7a');
            if (chainId === '0x7a') {
              initializeContracts(web3Instance);
            } else {
              setContract(null);
            }
          });
          setLoading(false);
        } catch (error) {
          console.error('Error initializing Web3:', error);
          setError('Error initializing Web3. Please try again.');
          setLoading(false);
        }
      } else {
        console.error('MetaMask is not installed.');
        setError('MetaMask is not installed. Please install MetaMask to use this app.');
        setLoading(false);
      }
    };

    const initializeContracts = async (web3Instance) => {
      try {
        const contractInstance = new web3Instance.eth.Contract(CONTRACT_ABI, REACT_APP_CONTRACT_ADDRESS);
        setContract(contractInstance);
      } catch (error) {
        console.error('Error loading contract:', error);
        setError('Error loading contract. Please ensure the contract ABI is correct.');
      }
    };

    const handleChainChanged = async (chainId) => {
        chainId = `0x${chainId.toString(16)}`;
        setIsFuseNetwork(chainId === '0x7a');
  
        if (chainId === '0x7a') {
          initializeContracts(web3);
        } else {
          setContract(null);
        }
      };

    initializeWeb3();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const fetchUsdcBalance = async () => {
    const usdcContract = new web3.eth.Contract(USDC_CONTRACT_ABI, REACT_APP_USDC_CONTRACT_ADDRESS);
    const balance = await usdcContract.methods.balanceOf(account).call();
    setUsdcBalance(Number(web3.utils.fromWei(balance, 'mwei')).toFixed(6));  
  };

  const initializeContracts = async () => {
    if (!web3) return; // Check if web3 is available
    try {
      const wethInstance = new web3.eth.Contract(WETH_CONTRACT_ABI, REACT_APP_WETH_CONTRACT_ADDRESS);
      setWethContract(wethInstance);
      // Check WETH allowance
      await checkWethApproval(wethInstance);      
      const usdcInstance = new web3.eth.Contract(USDC_CONTRACT_ABI, REACT_APP_USDC_CONTRACT_ADDRESS);
      setUsdcContract(usdcInstance);
      // Check USDC allowance
      await checkUsdcApproval(usdcInstance);
    } catch (err) {
      console.error("Error initializing contracts:", err);
      setError("Failed to initialize contracts. Please try again.");
    }
  };
  
  const checkWethApproval = async (wethInstance) => {
    try {
      const amountInWei = web3.utils.toWei(depositAmount || '0', 'ether');
      const allowance = await wethInstance.methods.allowance(account, REACT_APP_CONTRACT_ADDRESS).call();
      setIsWethApproved((parseFloat(allowance) > 0) && parseFloat(allowance) >= parseFloat(amountInWei) );

    } catch (err) {
      loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
      console.error("Error checking WETH approval:", err);
      setError("Failed to check WETH approval. Please try again.");
    }
  };

  const checkUsdcApproval = async (usdcInstance) => {
    try {
      const usdcAmountInWei = web3.utils.toWei(repayAmount || '0', 'mwei');
      const allowance = await usdcInstance.methods.allowance(account, REACT_APP_CONTRACT_ADDRESS).call();
      setIsUsdcApproved((usdcAmountInWei > 0) && (parseFloat(allowance)) > 0 && parseFloat(allowance) >= parseFloat(usdcAmountInWei));

    } catch (err) {
      console.error("Error checking USDC approval:", err);
      setError("Failed to check USDC approval. Please try again.");
    }
  };

  const handleUsdcApproveOrRepay = async () => {
    if (!isUsdcApproved) {
      // Approve USDC
      try {
        const usdcAmount = web3.utils.toWei(debt, 'mwei');
        await usdcContract.methods.approve(REACT_APP_CONTRACT_ADDRESS, debt).send({ from: account });
        setError(null); 
        checkUsdcApproval(usdcContract); // Recheck approval after the transaction
      } catch (err) {
        console.error("Error approving USDC:", err);
        setError("Failed to approve USDC. Please try again.");
      }
    } else {
      // Repay USDC
      try {
        const usdcAmount = web3.utils.toWei(repayAmount, 'mwei');
        await contract.methods.repay(usdcAmount).send({ from: account });
        loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
        setIsUsdcApproved(false);
        setError(null); 
      } catch (err) {
        setIsUsdcApproved(false);
        console.error("Error repaying USDC:", err);
        setError("Failed to repay USDC. Please try again.");
      }
    }
  };

  const handleWethApproveOrDeposit = async () => {
    if (!isWethApproved) {
      try {
        const amountInWei = web3.utils.toWei(depositAmount, 'ether');
        await wethContract.methods.approve(REACT_APP_CONTRACT_ADDRESS, amountInWei).send({ from: account });
        setError(null); 
        checkWethApproval(wethContract); // Recheck approval after the transaction
      } catch (err) {
        console.error("Error approving WETH:", err);
        setError("Failed to approve WETH. Please try again.");
      }
    } else {
        try {
            const amountInWei = web3.utils.toWei(depositAmount, 'ether');
            await contract.methods.deposit(amountInWei).send({ from: account });
            loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
          setError(null); 
        } catch (err) {
            //to check
            loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
            setIsWethApproved(false);

            console.error("Error depositing WETH:", err);
            setError("Failed to deposit WETH. Please Approve and try again.");
        }
    }
  };

  const listenToEvents = () => {
    if (!contract) return;
    try {
      contract.events.USDCBorrowed({ filter: { user: account } })
        .on('data', (event) => {
                loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
        })
        .on('error', (error) => {
          console.error('Error on Borrowed event:', error);
          setError("Failed to listen to Borrowed event. Please try again.");
        });
        
      contract.events.USDCRepaid({ filter: { user: account } })
        .on('data', (event) => {
          loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
        })
        .on('error', (error) => {
          console.error('Error on Repaid event:', error);
          setError("Failed to listen to Repaid event. Please try again.");
        });
    }
    catch(error){
     // console.error('no such event')
    }
  };

  const borrowUSDC = async () => {
    try {

      const usdcAmount = web3.utils.toWei(borrowAmount, 'mwei'); 
      await contract.methods.borrow(usdcAmount).send({ from: account });
      loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);
      setError(null); 
    } catch (err) {
        console.error("Error borrowing USDC:", err.toString());
        if (err.message.includes("revert")) {
          const reason = err.message.match(/revert (.*)/);
          setError(reason ? reason[1] : "Transaction reverted. Please check that you have enough collateral and try again.");
        } else {
          setError("Failed to borrow USDC. Please try again.");
        }
      }
  };

  const setMaxWithdrawAmount = () => {
    const maxCollateralInEther = web3.utils.fromWei(collateral, 'ether');
    setWithdrawAmount(maxCollateralInEther);
  };
  
  const setMaxDepositAmount = () => {
    const maxDepositlInEther = Number(wethBalance).toFixed(6);
    setDepositAmount(maxDepositlInEther);
  };

  const setMaxBorrowAmount = () => {
    const maxBorrowAmountInUsdc = Number(web3.utils.fromWei(maxBorrow, 'mwei'));
    console.log('maxBorrow',maxBorrow, 'maxBorrowAmountInUsdc', maxBorrowAmountInUsdc)
    setBorrowAmount(maxBorrowAmountInUsdc  ? maxBorrowAmountInUsdc : 0);
  }; 

  useEffect(() => {
    const maxDebt =  debt ? web3.utils.fromWei(debt, 'mwei') : 0;
    setRepayAmount(maxDebt);
     }, [debt]);
  
  const setMaxRepayAmount = async () => {
    const maxDebt =  debt ? web3.utils.fromWei(debt, 'mwei') : 0;
    setRepayAmount(maxDebt);
    loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);

  };
  
  const withdrawCollateral = async () => {
    try {
      const amountInWei = web3.utils.toWei(withdrawAmount, 'ether');
      await contract.methods.withdraw(amountInWei).send({ from: account });
            loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);


      setError(null); 
      } catch (err) {
        console.error("Error withdrawing collateral:", err);
        setError("Failed to withdraw collateral. Please try again.");
      }
  };

  const toggleCollateral = async () => {
    try {
        
      if (!collateralEnabled) {
        await contract.methods.enableCollateral().send({ from: account });
      } else {
        await contract.methods.disableCollateral().send({ from: account });
      }
            loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);

      setError(null); 
    } catch (err) {
      console.error("Error toggling collateral:", err);
      const actionOn = (collateralEnabled ? "disable" : "enable")
      setError("Failed to "+ actionOn +" collateral. Ensure no debt are deposited.");
    }
  };

  const toggleContractPause = async () => {
    try {
      if (paused) {
        await contract.methods.unpause().send({ from: account });
      } else {
        await contract.methods.pause().send({ from: account });
      }
            loadContractData(web3,account,setContract,setCollateral,setInterestRate,setMaxBorrow,setCollateralPriceUSD,setDebt,setHealthFactor,setCollateralEnabled,setWethBalance,setWethBalancePriceUSD,setPaused,setIsOwner,fetchUsdcBalance,setError);

      setError(null); 
    } catch (err) {
      console.error("Error toggling contract pause:", err);
      setError("Failed to toggle contract pause. Please try again.");
    }
  };

  if (!account) {
    return (
        <div className="App">
        <header className="header">
          <h2 className="header-title">Lending On Fuse</h2>
          <button className="connect-btn" onClick={() => connectWallet(setAccount, setError, web3, isFuseNetwork, switchToFuseNetwork)}>
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </header>
        <div className="container">
          <h1>Please, connect your wallet</h1>
          <p>Please connect your wallet to see your supplies, borrowings, and open positions.</p>
        <button className="connect-button-not-logged" onClick={() => connectWallet(setAccount, setError, web3, isFuseNetwork, switchToFuseNetwork)}>
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
        </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
   <header className="header">
        <h2 className="header-title">Lending On Fuse</h2>
        <button className="connect-btn" onClick={() => connectWallet(setAccount, setError, web3, isFuseNetwork, switchToFuseNetwork)}>
          <img src={fuseIcon} className="fuse-icon" alt="Fuse Icon"/>
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
        </button>
        {!isFuseNetwork &&  (
          <button className="switch-network-btn" onClick={() => switchToFuseNetwork(setError)}>
            Switch to Fuse Network
          </button>
        )}
      </header>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
         (
          isFuseNetwork && contract ? (
    <div className="container">
      {error && <p className="error">{error}</p>}
      <BorrowDetails healthFactor={healthFactor} web3={web3} account={account} contract={contract} />

      {/* Current Supply Section */}
      <div className="tables-container">
                <YourSupplies
                  web3={web3}
                  collateral={collateral}
                  collateralPriceUSD={collateralPriceUSD}
                  APY_eth={REACT_APP_APY_ETH}
                  collateralEnabled={collateralEnabled}
                  toggleCollateral={toggleCollateral}
                  withdrawAmount={withdrawAmount}
                  setWithdrawAmount={setWithdrawAmount}
                  withdrawCollateral={withdrawCollateral}
                  paused={paused}
                  debt={debt}
                  setMaxWithdrawAmount={setMaxWithdrawAmount}
                />

        {/* Your Borrows section */}
        <YourBorrows
                  web3={web3}
                  debt={debt}
                  interestRate={interestRate}
                  repayAmount={repayAmount}
                  setRepayAmount={setRepayAmount}
                  handleUsdcApproveOrRepay={handleUsdcApproveOrRepay}
                  paused={paused}
                  isUsdcApproved={isUsdcApproved}
                  setMaxRepayAmount={setMaxRepayAmount}
                />
      </div>

    {/* Assets to supply  Section */}
    <div className="tables-container">
            <AssetsToSupply
                  web3={web3}
                  wethBalance={wethBalance}
                  wethBalancePriceUSD={wethBalancePriceUSD}
                  APY_eth={REACT_APP_APY_ETH}
                  depositAmount={depositAmount}
                  setDepositAmount={setDepositAmount}
                  handleWethApproveOrDeposit={handleWethApproveOrDeposit}
                  paused={paused}
                  isWethApproved={isWethApproved}
                  setMaxDepositAmount={setMaxDepositAmount}
                />

            {/* Assets to borrow Section */}    
            <AssetsToBorrow
                  usdcBalance={usdcBalance}
                  interestRate={interestRate}
                  borrowAmount={borrowAmount}
                  setBorrowAmount={setBorrowAmount}
                  borrowUSDC={borrowUSDC}
                  paused={paused}
                  collateralEnabled={collateralEnabled}
                  setMaxBorrowAmount={setMaxBorrowAmount}
                />
        </div>

      {isOwner && (
        <div className="actions">
          <div className="toggle-section">
            <strong>
              Pause contract
              <label className="switch" title={paused ? 'Unpause Contract' : 'Pause Contract'}>
                <input
                  type="checkbox"
                  checked={paused}
                  onChange={toggleContractPause}
                />
                <span className="slider round"></span>
              </label>
            </strong>
          </div>      
        </div>     
      )}
    </div>
) : (
    !isFuseNetwork && (
      <div className="warning">
        Please switch to the Fuse network to use the app.
      </div>
    )
  )
)
)}
</div>
);
}

export default App;

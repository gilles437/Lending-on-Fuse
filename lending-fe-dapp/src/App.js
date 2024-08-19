import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import './App.css';
import ethIcon from './images/eth-icon.png';
import usdcIcon from './images/usdc-icon.png';
import fuseIcon from './images/fuse-icon.png';
import WETH_ABI from './abis/WETH_ABI.json'
import USDC_ABI from './abis/USDC_ABI.json'
import WORKING_CONTRACT_ABI from './abis/CONTRACT_ABI.json'
import BorrowDetails from './components/BorrowDetails'

const CONTRACT_ADDRESS = '0x80706258180341D8aE6334e1934EDC8E0649b057';
const CONTRACT_ABI = WORKING_CONTRACT_ABI;

const WETH_CONTRACT_ADDRESS = '0x5622F6dC93e08a8b717B149677930C38d5d50682'; 
const WETH_CONTRACT_ABI = WETH_ABI;
const USDC_CONTRACT_ADDRESS = '0x28C3d1cD466Ba22f6cae51b1a4692a831696391A'; 
const USDC_CONTRACT_ABI = USDC_ABI; 

const EXPLORER_FUSE_ADDRESS="https://explorer.fuse.io/address/"

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

  const APY_eth = '0%'

  useEffect(() => {
    if (web3 && account) {
      setError(null); 
      loadContractData();
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
        const contractInstance = new web3Instance.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
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

  const switchToFuseNetwork = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a' }],
        });
      } catch (error) {
        if (error.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x7a',
                  chainName: 'Fuse Mainnet',
                  rpcUrls: ['https://rpc.fuse.io'],
                  nativeCurrency: {
                    name: 'FUSE',
                    symbol: 'FUSE',
                    decimals: 18,
                  },
                  blockExplorerUrls: ['https://explorer.fuse.io'],
                },
              ],
            });
          } catch (addError) {
            console.error('Error adding Fuse network:', addError);
            setError('Error adding Fuse network. Please try again.');
          }
        } else {
          console.error('Error switching network:', error);
          setError('Error switching network. Please try again.');
        }
      }
    } else {
      console.error('MetaMask is not installed.');
      setError('MetaMask is not installed. Please install MetaMask to use this app.');
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        if (web3 && !isFuseNetwork) {
          await switchToFuseNetwork();
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
        setError('Error connecting wallet. Please try again.');
      }
    } else {
      console.error('MetaMask is not installed.');
      setError('MetaMask is not installed. Please install MetaMask to use this app.');
    }
  };
  
  const fetchUsdcBalance = async () => {
    const usdcContract = new web3.eth.Contract(USDC_CONTRACT_ABI, USDC_CONTRACT_ADDRESS);
    const balance = await usdcContract.methods.balanceOf(account).call();
    setUsdcBalance(Number(web3.utils.fromWei(balance, 'mwei')).toFixed(6));  
  };

  const initializeContracts = async () => {
    if (!web3) return; // Check if web3 is available
    try {
      const wethInstance = new web3.eth.Contract(WETH_CONTRACT_ABI, WETH_CONTRACT_ADDRESS);
      setWethContract(wethInstance);
      // Check WETH allowance
      await checkWethApproval(wethInstance);      
      const usdcInstance = new web3.eth.Contract(USDC_CONTRACT_ABI, USDC_CONTRACT_ADDRESS);
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
      const allowance = await wethInstance.methods.allowance(account, CONTRACT_ADDRESS).call();
      setIsWethApproved((parseFloat(allowance) > 0) && parseFloat(allowance) >= parseFloat(amountInWei) );

    } catch (err) {
      loadContractData();
      console.error("Error checking WETH approval:", err);
      setError("Failed to check WETH approval. Please try again.");
    }
  };

  const checkUsdcApproval = async (usdcInstance) => {
    try {
      const usdcAmountInWei = web3.utils.toWei(repayAmount || '0', 'mwei');
      const allowance = await usdcInstance.methods.allowance(account, CONTRACT_ADDRESS).call();

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
        const usdcAmount = web3.utils.toWei(repayAmount, 'mwei');
        await usdcContract.methods.approve(CONTRACT_ADDRESS, usdcAmount).send({ from: account });
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
        loadContractData();
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
        await wethContract.methods.approve(CONTRACT_ADDRESS, amountInWei).send({ from: account });
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
            loadContractData();
            setError(null); 
        } catch (err) {
            //to check
            loadContractData();
            setIsWethApproved(false);

            console.error("Error depositing WETH:", err);
            setError("Failed to deposit WETH. Please try again.");
        }
    }
  };

  const loadContractData = async () => {
    try {
      const contractInstance = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
      setContract(contractInstance);

        const accountInfo = await contractInstance.methods.getAccountInfo(account).call();
        setCollateral(accountInfo.collateralAmount);
        setInterestRate(Number(accountInfo.interRate) / 100);
        setMaxBorrow(Number(accountInfo.maxBorrow));
        const collateralPriceInUSD =  web3.utils.fromWei(accountInfo.collateralAmount, 'ether') * web3.utils.fromWei(accountInfo.ethPrice, 'ether');
      
        setCollateralPriceUSD(collateralPriceInUSD);
        setDebt(accountInfo.debtAmount);
        
        if (Number(accountInfo.debtAmount) == 0) {
            setHealthFactor((2**256-1));
        }
        else {
            setHealthFactor(web3.utils.fromWei(Number(accountInfo.collateralValue), 'ether') / web3.utils.fromWei(Number(accountInfo.debtAmount), 'mwei') );
        }
        setCollateralEnabled(accountInfo.isCollateralEnabled);
   
        const wethContract = new web3.eth.Contract(WETH_CONTRACT_ABI, WETH_CONTRACT_ADDRESS);
        const balance = await wethContract.methods.balanceOf(account).call();
        setWethBalance(web3.utils.fromWei(balance, 'ether'));  
        const wethBalanceInUsd =  parseFloat(web3.utils.fromWei(balance, 'ether')) * web3.utils.fromWei(accountInfo.ethPrice, 'ether');
        setWethBalancePriceUSD(wethBalanceInUsd)
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

  const listenToEvents = () => {
    if (!contract) return;
    try {
      contract.events.USDCBorrowed({ filter: { user: account } })
        .on('data', (event) => {
          loadContractData();
        })
        .on('error', (error) => {
          console.error('Error on Borrowed event:', error);
          setError("Failed to listen to Borrowed event. Please try again.");
        });
        
      contract.events.USDCRepaid({ filter: { user: account } })
        .on('data', (event) => {
          loadContractData();
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
      loadContractData();
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
    const maxBorrowAmountInUsdc = web3.utils.fromWei(maxBorrow, 'ether');
    setBorrowAmount(maxBorrowAmountInUsdc);
  };


  const setMaxRepayAmount = () => {
    const maxDebt = web3.utils.fromWei(debt, 'mwei')
    setRepayAmount(maxDebt);
  };
  
  const withdrawCollateral = async () => {
    try {
      const amountInWei = web3.utils.toWei(withdrawAmount, 'ether');
      await contract.methods.withdraw(amountInWei).send({ from: account });
      loadContractData();
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
      loadContractData();
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
      loadContractData();
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
          <button className="connect-btn" onClick={connectWallet}>
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </header>
        <div className="container">
          <h1>Please, connect your wallet</h1>
          <p>Please connect your wallet to see your supplies, borrowings, and open positions.</p>
        <button className="connect-button-not-logged" onClick={connectWallet}>
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
        <button className="connect-btn" onClick={connectWallet}>
          <img src={fuseIcon} className="fuse-icon" alt="Fuse Icon"/>
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
        </button>
        {!isFuseNetwork &&  (
          <button className="switch-network-btn" onClick={switchToFuseNetwork}>
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
        <div className="table-block">
          <h3>Your Supplies</h3>
          <table className="supplies-table">
            <thead>
              <tr>
                <th>Assets</th>
                <th>Balance</th>
                <th>APY</th>
                <th>Collateral</th>
                <th>Withdraw</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <img src={ethIcon} alt="Ethereum" className="asset-icon" /> <a target="_blank" href={EXPLORER_FUSE_ADDRESS + WETH_CONTRACT_ADDRESS}>WETH</a>
                </td>
                <td>
                  {web3.utils.fromWei(collateral, 'ether')} ETH<br />
                  ${collateralPriceUSD.toFixed(6)}
                </td>
                <td>{APY_eth}%</td>
                <td>

                  <label className="switch" title={collateralEnabled ? 'Disable collateral' : 'Enable collateral'}>
                    <input
                      type="checkbox"
                      checked={collateralEnabled}
                      onChange={toggleCollateral}
                    />
                    <span className="slider round"></span>
                  </label>
                </td>
                <td>
                <div className="actions">    
                    <div className="action">
                    <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Amount to withdraw (WETH)"
                        disabled={paused || debt > 0}
                        />
                    <button className="action-btn" onClick={withdrawCollateral} disabled={paused || debt > 0}>Withdraw</button>
                    <button className="max-btn" onClick={setMaxWithdrawAmount} disabled={paused || debt > 0}>
                    Max
                    </button>
                    </div>
                </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  
        {/* Your Borrows section */}
        <div className="table-block">
          <h3>Your Borrows</h3>
          <table className="borrows-table">
            <thead>
              <tr>
                <th>Assets</th>
                <th>Balance</th>
                <th>APY</th>
                <th>Repay</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <img src={usdcIcon} alt="USDC" className="asset-icon" /> <a target="_blank" href={EXPLORER_FUSE_ADDRESS + USDC_CONTRACT_ADDRESS}>USDC</a>
                </td>
                <td>
                  {Number(web3.utils.fromWei(debt, 'mwei')).toFixed(6)} USDC
                </td>
                <td>{interestRate}%</td>
                <td>
                <div className="actions">    
                    <div className="action">
                        <input
                            type="number"
                            value={repayAmount}
                            onChange={(e) => setRepayAmount(e.target.value)}
                            placeholder="Amount to repay (USDC)"
                        />
                        <button className="action-btn" onClick={handleUsdcApproveOrRepay} disabled={paused || debt == 0}>
                            {(isUsdcApproved === true) ? 'Repay' : 'Approve'}
                        </button>
                        <button  className="max-btn" onClick={setMaxRepayAmount} disabled={paused || debt == 0}>
                            Max
                        </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    {/* Assets to supply  Section */}
    <div className="tables-container">
            <div className="table-block">
            <h3>Assets to Supply</h3>
            <table className="supplies-table">
                <thead>
                <tr>
                    <th>Assets</th>
                    <th>Balance</th>
                    <th>APY</th>
                    <th>Collateral</th>
                    <th>Deposit</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td>
                    <img src={ethIcon} alt="Ethereum" className="asset-icon" /> <a target="_blank" href={EXPLORER_FUSE_ADDRESS + WETH_CONTRACT_ADDRESS}>WETH</a>
                    </td>
                    <td>
                        {parseFloat(wethBalance).toFixed(6)} ETH<br />
                        ${wethBalancePriceUSD.toFixed(6)}
                    </td>
                    <td>{APY_eth}%</td>
                    <td >
                    <strong>✓</strong>
                    </td>
                    <td>
                    <div className="actions">    
                    <div className="action">
                        <input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="Amount to deposit (WETH)"
                        />
                        <button className="action-btn" onClick={handleWethApproveOrDeposit} disabled={paused}>
                            {(isWethApproved === true) ? 'Deposit' : 'Approve'}
                        </button>
                        <button className="max-btn" onClick={setMaxDepositAmount} disabled={paused}>
                                Max
                        </button>
            
                    </div>
                </div>
            </td>
                </tr>
                </tbody>
            </table>
            </div>

            {/* Assets to borrow Section */}    
            <div className="table-block">
            <h3>Assets to Borrow</h3>
            <table className="borrows-table">
                <thead>
                <tr>
                    <th>Assets</th>
                    <th>Balance</th>
                    <th>APY</th>
                    <th>Borrow</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td>
                    <img src={usdcIcon} alt="USDC" className="asset-icon" /> <a target="_blank" href={EXPLORER_FUSE_ADDRESS + USDC_CONTRACT_ADDRESS}>USDC</a>
                    </td>
                    <td>
                    {usdcBalance} USDC
                    </td>
                    <td>{interestRate}%</td>
                    <td>
                    <div className="actions">    

                    <div className="action">
                    <input
                        type="number"
                        value={borrowAmount}
                        onChange={(e) => setBorrowAmount(e.target.value)}
                        placeholder="Amount to borrow (USDC)"
                    />
                    <button className="action-btn" onClick={borrowUSDC} 
                            disabled={paused || !collateralEnabled}>
                        Borrow
                    </button>
                    <button className="max-btn" onClick={setMaxBorrowAmount} disabled={paused || !collateralEnabled}>
                    Max
                    </button>
                    </div>

                    </div>
                    </td>
                </tr>
                </tbody>
            </table>
            </div>
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

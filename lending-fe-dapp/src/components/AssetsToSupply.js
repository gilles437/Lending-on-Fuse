import React from 'react';
import ethIcon from '../images/eth-icon.png';

const  { 
    REACT_APP_WETH_CONTRACT_ADDRESS, REACT_APP_EXPLORER_FUSE_ADDRESS} = process.env

const AssetsToSupply = ({
  web3,
  wethBalance,
  wethBalancePriceUSD,
  depositAmount,
  setDepositAmount,
  handleWethApproveOrDeposit,
  setMaxDepositAmount,
  paused,
  isWethApproved
}) => (
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
            <img src={ethIcon} alt="Ethereum" className="asset-icon" /> <a target="_blank" href={REACT_APP_EXPLORER_FUSE_ADDRESS + REACT_APP_WETH_CONTRACT_ADDRESS}>WETH</a>
        </td>
          <td>
            {parseFloat(wethBalance).toFixed(6)} ETH<br />
            ${wethBalancePriceUSD.toFixed(6)}
          </td>
          <td>0%</td>
          <td>
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
                  {isWethApproved ? 'Deposit' : 'Approve'}
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
);

export default AssetsToSupply;

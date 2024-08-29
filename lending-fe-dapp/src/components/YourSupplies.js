import React from 'react';
import ethIcon from '../images/eth-icon.png';

const  {REACT_APP_WETH_CONTRACT_ADDRESS, REACT_APP_EXPLORER_FUSE_ADDRESS} = process.env
        
const YourSupplies = ({
  web3,
  collateral,
  collateralPriceUSD,
  collateralEnabled,
  toggleCollateral,
  withdrawAmount,
  setWithdrawAmount,
  withdrawCollateral,
  setMaxWithdrawAmount,
  paused,
  debt
}) => (
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
            <img src={ethIcon} alt="Ethereum" className="asset-icon" /> <a target="_blank" href={REACT_APP_EXPLORER_FUSE_ADDRESS + REACT_APP_WETH_CONTRACT_ADDRESS}>WETH</a>
          </td>
          <td>
            {web3.utils.fromWei(collateral, 'ether')} ETH<br />
            ${collateralPriceUSD.toFixed(6)}
          </td>
          <td>0%</td>
          <td>
            <label className="switch" title={collateralEnabled ? 'Disable collateral' : 'Enable collateral'}>
              <input type="checkbox" checked={collateralEnabled} onChange={toggleCollateral} />
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
                  disabled={paused}
                />
                <button className="action-btn" onClick={withdrawCollateral} disabled={paused || debt > 0}>
                  Withdraw
                </button>
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
);

export default YourSupplies;

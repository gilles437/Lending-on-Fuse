import React from 'react';
import usdcIcon from '../images/usdc-icon.png';

const  { REACT_APP_USDC_CONTRACT_ADDRESS, REACT_APP_EXPLORER_FUSE_ADDRESS} = process.env

const AssetsToBorrow = ({
  usdcBalance,
  interestRate,
  borrowAmount,
  setBorrowAmount,
  borrowUSDC,
  setMaxBorrowAmount,
  paused,
  collateralEnabled
}) => (
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
            <img src={usdcIcon} alt="USDC" className="asset-icon" /> <a target="_blank" href={REACT_APP_EXPLORER_FUSE_ADDRESS + REACT_APP_USDC_CONTRACT_ADDRESS}>USDC</a>
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
                <button className="action-btn" onClick={borrowUSDC} disabled={paused || !collateralEnabled}>
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
);

export default AssetsToBorrow;

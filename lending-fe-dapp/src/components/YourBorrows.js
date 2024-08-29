import React from 'react';
import usdcIcon from '../images/usdc-icon.png';

const  { REACT_APP_USDC_CONTRACT_ADDRESS, REACT_APP_EXPLORER_FUSE_ADDRESS} = process.env

const YourBorrows = ({
  web3,
  debt,
  interestRate,
  repayAmount,
  setRepayAmount,
  handleUsdcApproveOrRepay,
  setMaxRepayAmount,
  paused,
  isUsdcApproved
}) => (
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
                  <img src={usdcIcon} alt="USDC" className="asset-icon" /> <a target="_blank" href={REACT_APP_EXPLORER_FUSE_ADDRESS + REACT_APP_USDC_CONTRACT_ADDRESS}>USDC</a>
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
                  {isUsdcApproved ? 'Repay' : 'Approve'}
                </button>
                <button className="max-btn" onClick={setMaxRepayAmount} disabled={paused || debt == 0}>
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

export default YourBorrows;

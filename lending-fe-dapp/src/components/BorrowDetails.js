import React, { useEffect, useState } from 'react';
import { FaCoins, FaClock, FaHeartbeat, FaDollarSign, FaPercentage } from 'react-icons/fa';
import './BorrowDetails.css';

const BorrowDetails = ({ healthFactor, web3, account, contract }) => {
    const [principal, setPrincipal] = useState(null);
    const [accruedInterest, setAccruedInterest] = useState(null);
    const [userLastTimestamp, setUserLastTimestamp] = useState(null);
    const LIQUIDATION_THRESHOLD = 0.5;

    useEffect(() => {
        async function fetchDebtInfo() {
            if (web3 && account && contract) { 
                try {
                    // Call the getDebtInfo function from the smart contract
                    const debtInfo = await contract.methods.getDebtInfo(account).call();
                    //console.log('accruedInterest',debtInfo.accruedInterest,'principal', debtInfo.principal,'userLastTimestamp', debtInfo.userLastTimestamp)
                    setPrincipal(Number(web3.utils.fromWei(debtInfo.principal, 'mwei')).toFixed(6));  
                    setAccruedInterest(Number(web3.utils.fromWei(debtInfo.accruedInterest, 'mwei')).toFixed(6));
                    setUserLastTimestamp(debtInfo.userLastTimestamp);
             
                } catch (error) {
                    console.error("Error fetching debt info:", error);
                }
            }
        } 

        fetchDebtInfo();
    }, [web3, account, contract]);

    function pad(n) {
        return n<10 ? '0'+n : n;
    }

    const displayDate = (borrowTime) => {
        const timeStampInSecs = Math.ceil(Number(borrowTime) * 1000);

        const borrowDate = new Date(timeStampInSecs)
        function pad(n) {
            return n<10 ? '0'+n : n;
        }
        
        const localDateTime = borrowDate.getFullYear() +
                      "-" +pad(borrowDate.getMonth()+1) +
                      "-" + pad(borrowDate.getDate()) +
                      " " + pad(borrowDate.getHours()) +
                      ":" + pad(borrowDate.getMinutes()) +
                      ":" + pad(borrowDate.getSeconds());

        return localDateTime;

    }
    return (<div>
        <div className="borrow-details-card">
            <div className="borrow-info">
                <div className="borrow-item">
                    <FaHeartbeat className="icon" title="The collateral value divided by the debt, if debt is not null, otherwise infinite." />
                    <p><strong>Health Factor: {(healthFactor  == (2**256-1)) ? '∞' : `${(parseFloat(healthFactor) * LIQUIDATION_THRESHOLD).toFixed(2)}` }</strong></p>
                </div>
                <div className="borrow-item">
                    <FaCoins className="icon" title="The borrow you made"/>
                    <p><strong>Borrow:</strong> {principal ? `${parseFloat(principal).toFixed(6)}` : 0} USDC</p>
                </div>
            </div>
            
            <div className="borrow-info">
                <div className="borrow-item">
                    <FaPercentage className="icon"  title="The accrued interest of the borrow you made"/>
                    <p><strong>Accrued Interest:</strong> {accruedInterest ? `${parseFloat(accruedInterest).toFixed(6)}` : 0} USDC</p>
                </div>
            </div>
        </div>
        </div>
    );
};

export default BorrowDetails;

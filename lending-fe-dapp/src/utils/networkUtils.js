

export const switchToFuseNetwork = async (setError) => {
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

export const connectWallet = async (setAccount, setError, web3, isFuseNetwork, switchToFuseNetwork) => {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      if (web3 && !isFuseNetwork) {
        await switchToFuseNetwork(setError);
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

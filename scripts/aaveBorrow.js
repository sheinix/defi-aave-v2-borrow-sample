const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")

async function main() {
    // the protocol treats everything as an erc20 token
    await getWeth()

    const { deployer } = await getNamedAccounts()

    // lending pool address provider v2 aave: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5

    const lendingPool = await getLendingPool(deployer)
    console.log(`👉🏻  Lending Pool Adress: ${lendingPool.address}`)

    // deposit!
    // but first approve the contract for erc tx
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    // aprove:
    await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("👉🏻 Depositing...")

    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("👉🏻 Deposited!!")

    // Borrow time:
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

    const daiPrice = await getDAIPrice()

    const amountOfDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())

    console.log(`👉🏻You can borrow ${amountOfDaiToBorrow.toString()} DAI`)

    const amountDaiToBorrowWei = ethers.utils.parseEther(amountOfDaiToBorrow.toString())

    // Now Borrow:
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)

    await getBorrowUserData(lendingPool, deployer)
    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveERC20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("👉🏻Repayed!!!!")
}

async function borrowDai(daiAddress, lendingPool, amountOfDaiToBorrowWei, account) {
    // parameter "1" refers to the interest rate type (stable)
    // paramter "0" is the referall code that is deprecated
    const borrowTx = await lendingPool.borrow(daiAddress, amountOfDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log(`👉🏻You've Borrowed!`)
}
async function getDAIPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4"
    )

    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`👉🏻 The DAI/ETH price is ${price.toString()}`)
    return price
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH Deposited`)
    console.log(`You have ${totalDebtETH} worth of ETH as Debt`)
    console.log(`You have ${availableBorrowsETH} worth of ETH as available to borrow`)
    return { availableBorrowsETH, totalDebtETH }
}

async function approveERC20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log(`👉🏻 Approved!!!`)
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account
    )

    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

import Box from "@material-ui/core/Box"
import makeStyles from "@material-ui/core/styles/makeStyles"
import Typography from "@material-ui/core/Typography"
import WarningIcon from "@material-ui/icons/Warning"
import { PayStellarUri } from "@stellarguard/stellar-uri"
import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { Asset, Server, Transaction } from "stellar-sdk"
import AccountSelectionList from "~Account/components/AccountSelectionList"
import { Account, AccountsContext } from "~App/contexts/accounts"
import { trackError } from "~App/contexts/notifications"
import { breakpoints, warningColor } from "~App/theme"
import MainTitle from "~Generic/components/MainTitle"
import ViewLoading from "~Generic/components/ViewLoading"
import { useLiveAccountDataSet, useLiveAccountOffers } from "~Generic/hooks/stellar-subscriptions"
import { RefStateObject, useDialogActions } from "~Generic/hooks/userinterface"
import { AccountData } from "~Generic/lib/account"
import { getAssetsFromBalances } from "~Generic/lib/stellar"
import DialogBody from "~Layout/components/DialogBody"
import { PaymentParams } from "~Payment/components/PaymentDialog"
import PaymentForm from "~Payment/components/PaymentForm"
import TransactionSender, { SendTransaction } from "../../Transaction/components/TransactionSender"
import NoAccountsDialog from "./ NoAccountsDialog"

interface ConnectedPaymentFormProps {
  accountData: AccountData
  actionsRef: RefStateObject
  horizon: Server
  onClose: () => void
  preselectedParams: PaymentParams
  selectedAccount: Account
  sendTransaction: SendTransaction
}

function ConnectedPaymentForm(props: ConnectedPaymentFormProps) {
  const { sendTransaction } = props
  const testnet = props.selectedAccount.testnet

  const [txCreationPending, setTxCreationPending] = React.useState(false)
  const { offers: openOrders } = useLiveAccountOffers(props.selectedAccount.publicKey, testnet)
  const trustedAssets = React.useMemo(() => getAssetsFromBalances(props.accountData.balances) || [Asset.native()], [
    props.accountData.balances
  ])

  const handleSubmit = React.useCallback(
    async (createTx: (horizon: Server, account: Account) => Promise<Transaction>) => {
      try {
        setTxCreationPending(true)
        const tx = await createTx(props.horizon, props.selectedAccount)
        setTxCreationPending(false)
        await sendTransaction(tx)
      } catch (error) {
        trackError(error)
      } finally {
        setTxCreationPending(false)
      }
    },
    [props.selectedAccount, props.horizon, sendTransaction]
  )

  return (
    <PaymentForm
      accountData={props.accountData}
      actionsRef={props.actionsRef}
      onCancel={props.onClose}
      onSubmit={handleSubmit}
      openOrdersCount={openOrders.length}
      preselectedParams={props.preselectedParams}
      testnet={testnet}
      trustedAssets={trustedAssets}
      txCreationPending={txCreationPending}
    />
  )
}

const useStyles = makeStyles(() => ({
  assetContainer: {
    alignSelf: "center",
    display: "flex",
    margin: "0px 8px"
  },
  assetLogo: {
    width: 28,
    height: 28,
    margin: "0px 4px"
  },
  root: {
    display: "flex",
    flexDirection: "column",
    padding: "12px 0 0"
  },
  row: {
    lineHeight: 1.2
  },
  keyTypography: {
    alignSelf: "center",
    textAlign: "right"
  },
  valueTypography: {
    textAlign: "left"
  },
  uriContainer: {
    paddingTop: 32,
    paddingBottom: 32
  },
  warningContainer: {
    alignItems: "center",
    alignSelf: "center",
    background: warningColor,
    display: "flex",
    justifyContent: "center",
    padding: "6px 16px",
    width: "fit-content",

    [breakpoints.up(600)]: {
      width: "100%"
    }
  }
}))

interface PaymentAccountSelectionDialogProps {
  accounts: Account[]
  horizon: Server
  onAccountChange: (account: Account) => void
  onClose: () => void
  payStellarUri: PayStellarUri
  selectedAccount: Account | null
  sendTransaction: SendTransaction
}

function PaymentAccountSelectionDialog(props: PaymentAccountSelectionDialogProps) {
  const { onClose, onAccountChange } = props
  const {
    amount,
    assetCode,
    assetIssuer,
    destination,
    memo,
    memoType,
    msg,
    originDomain,
    signature,
    isTestNetwork: testnet
  } = props.payStellarUri

  const classes = useStyles()
  const { t } = useTranslation()
  const accountDataSet = useLiveAccountDataSet(
    props.accounts.map(acc => acc.publicKey),
    testnet
  )
  const accountData = accountDataSet.find(acc => acc.account_id === props.selectedAccount?.publicKey)
  const dialogActionsRef = useDialogActions()

  const asset = React.useMemo(() => (assetCode && assetIssuer ? new Asset(assetCode, assetIssuer) : Asset.native()), [
    assetCode,
    assetIssuer
  ])
  const paymentParams = React.useMemo(() => {
    return {
      amount,
      asset,
      destination,
      memo,
      memoType
    }
  }, [amount, asset, destination, memo, memoType])

  return (
    <DialogBody
      preventNotchSpacing
      top={
        <MainTitle hideBackButton onBack={onClose} title={t("transaction-request.payment-account-selection.title")} />
      }
      actions={dialogActionsRef}
    >
      <Box className={classes.root}>
        {signature ? (
          <Typography>
            <Trans i18nKey="transaction-request.payment-account-selection.header.origin-domain">
              The following transaction has been proposed by <b>{{ originDomain }}</b>.
            </Trans>
          </Typography>
        ) : (
          <Box className={classes.warningContainer}>
            <WarningIcon />
            <Typography style={{ padding: 8 }}>{t("transaction-request.payment-account-selection.warning")}</Typography>
            <WarningIcon />
          </Box>
        )}
        <React.Suspense fallback={<ViewLoading height={200} />}>
          {props.selectedAccount && accountData && (
            <>
              {msg && (
                <Typography style={{ marginTop: 8 }}>
                  <b>{t("transaction-request.payment.uri-content.message")}:</b> {msg}
                </Typography>
              )}
              <ConnectedPaymentForm
                accountData={accountData}
                actionsRef={dialogActionsRef}
                horizon={props.horizon}
                onClose={props.onClose}
                selectedAccount={props.selectedAccount}
                sendTransaction={props.sendTransaction}
                preselectedParams={paymentParams}
              />
            </>
          )}
        </React.Suspense>
        <Typography component="h6" variant="h6" style={{ marginTop: 8 }}>
          {t("transaction-request.payment-account-selection.account-selector")}
        </Typography>
        {props.accounts.length > 0 ? (
          <AccountSelectionList
            accounts={props.accounts}
            onChange={onAccountChange}
            selectedAccount={props.selectedAccount ? props.selectedAccount : undefined}
            testnet={testnet}
          />
        ) : (
          <Typography align="center" color="error" variant="h6" style={{ paddingTop: 16 }}>
            {asset.code === "XLM"
              ? t("transaction-request.payment-account-selection.error.no-activated-accounts")
              : t("transaction-request.payment-account-selection.error.no-accounts-with-trustline")}
          </Typography>
        )}
      </Box>
    </DialogBody>
  )
}

function ConnectedPaymentAccountSelectionDialog(
  props: Pick<PaymentAccountSelectionDialogProps, "payStellarUri" | "onClose">
) {
  const { accounts } = React.useContext(AccountsContext)
  const testnet = props.payStellarUri.isTestNetwork
  const accountsForNetwork = React.useMemo(() => accounts.filter(acc => acc.testnet === testnet), [accounts, testnet])
  const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(
    accountsForNetwork.length > 0 ? accountsForNetwork[0] : null
  )

  return accountsForNetwork.length > 0 ? (
    <TransactionSender account={selectedAccount || accountsForNetwork[0]} onSubmissionCompleted={props.onClose}>
      {({ horizon, sendTransaction }) => (
        <PaymentAccountSelectionDialog
          {...props}
          accounts={accountsForNetwork}
          horizon={horizon}
          selectedAccount={selectedAccount}
          onAccountChange={setSelectedAccount}
          sendTransaction={sendTransaction}
        />
      )}
    </TransactionSender>
  ) : (
    <NoAccountsDialog onClose={props.onClose} testnet={testnet} />
  )
}

export default ConnectedPaymentAccountSelectionDialog

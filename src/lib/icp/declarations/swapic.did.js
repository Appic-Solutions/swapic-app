export const idlFactory = ({ IDL }) => {
  const ActionAmounts = IDL.Record({
    'relay_local' : IDL.Nat,
    'complete_ck' : IDL.Nat,
    'relay_cctp' : IDL.Nat,
    'pool_transfer' : IDL.Opt(IDL.Nat),
    'relay_deliver' : IDL.Nat,
    'complete_swap' : IDL.Nat,
    'pool_move' : IDL.Opt(IDL.Nat),
    'release' : IDL.Nat,
    'pool_ck_deposit' : IDL.Opt(IDL.Nat),
    'pool_approve' : IDL.Opt(IDL.Nat),
    'eco_rescue' : IDL.Opt(IDL.Nat),
    'pool_payout' : IDL.Opt(IDL.Nat),
    'relay_eco' : IDL.Nat,
    'pool_move_finish' : IDL.Opt(IDL.Nat),
  });
  const ActionGas = IDL.Record({
    'relay_local' : IDL.Nat64,
    'complete_ck' : IDL.Nat64,
    'relay_cctp' : IDL.Nat64,
    'pool_transfer' : IDL.Opt(IDL.Nat64),
    'relay_deliver' : IDL.Nat64,
    'complete_swap' : IDL.Nat64,
    'pool_move' : IDL.Opt(IDL.Nat64),
    'release' : IDL.Nat64,
    'pool_ck_deposit' : IDL.Opt(IDL.Nat64),
    'pool_approve' : IDL.Opt(IDL.Nat64),
    'eco_rescue' : IDL.Opt(IDL.Nat64),
    'pool_payout' : IDL.Opt(IDL.Nat64),
    'relay_eco' : IDL.Nat64,
    'pool_move_finish' : IDL.Opt(IDL.Nat64),
  });
  const EvmChainConfig = IDL.Record({
    'cctp_receiver' : IDL.Text,
    'token_messenger' : IDL.Text,
    'runner' : IDL.Text,
    'usdc' : IDL.Text,
    'min_network_fee' : ActionAmounts,
    'gas_budget_wei' : ActionAmounts,
    'gas_limit' : ActionGas,
    'swapic' : IDL.Text,
    'message_transmitter' : IDL.Text,
  });
  const Config = IDL.Record({
    'confirmations' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64)),
    'audit_chunk_events' : IDL.Nat32,
    'rail_status_max_age_s' : IDL.Nat64,
    'expiry_check_interval_s' : IDL.Nat64,
    'batch_window_ms' : IDL.Nat64,
    'max_refunds_per_sweep' : IDL.Nat32,
    'ecdsa_key_name' : IDL.Text,
    'max_fee_bps' : IDL.Nat16,
    'pool_chain' : IDL.Opt(IDL.Nat64),
    'rpc_urls' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'books_check_interval_s' : IDL.Nat64,
    'simulate_before_sign' : IDL.Bool,
    'vault_addresses' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'eco_enabled' : IDL.Bool,
    'platform_fee_bps' : IDL.Nat16,
    'permit_deadline_s' : IDL.Nat64,
    'cctp_domains' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'cctp_min_fees' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'evm_chains' : IDL.Vec(IDL.Tuple(IDL.Nat64, EvmChainConfig)),
    'replay_audit_interval_s' : IDL.Nat64,
    'books_tolerance' : IDL.Nat,
    'quote_ttl_s' : IDL.Nat64,
    'eco_portal' : IDL.Opt(IDL.Text),
    'decision_timeout_min' : IDL.Nat64,
    'credit_confirmations' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64))),
    'usdc_addresses' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'chain_data_max_age_s' : IDL.Nat64,
    'max_swap_usd' : IDL.Nat,
    'max_batch_items' : IDL.Nat32,
    'claim_grace_s' : IDL.Nat64,
    'max_evictions_per_sweep' : IDL.Nat32,
    'deposit_lookback_blocks' : IDL.Nat32,
  });
  const InitArg = IDL.Record({
    'watcher' : IDL.Principal,
    'config' : Config,
    'quoter' : IDL.Principal,
  });
  const SwapStatus = IDL.Variant({
    'PaidInStable' : IDL.Null,
    'Refunding' : IDL.Null,
    'WaitingForUser' : IDL.Null,
    'FundsReceived' : IDL.Null,
    'Delivering' : IDL.Null,
    'Refunded' : IDL.Null,
    'Done' : IDL.Null,
    'Executing' : IDL.Null,
    'Frozen' : IDL.Null,
  });
  const PocketError = IDL.Variant({
    'Overflow' : IDL.Null,
    'InsufficientReserved' : IDL.Record({
      'requested' : IDL.Nat,
      'reserved' : IDL.Nat,
    }),
    'InsufficientAvailable' : IDL.Record({
      'requested' : IDL.Nat,
      'available' : IDL.Nat,
    }),
  });
  const QuoteError = IDL.Variant({
    'NotUtf8' : IDL.Record({ 'field' : IDL.Text }),
    'TextTooLong' : IDL.Record({ 'len' : IDL.Nat64, 'field' : IDL.Text }),
    'EmptyRefundAddress' : IDL.Null,
    'UnknownRail' : IDL.Text,
    'NotABool' : IDL.Record({ 'field' : IDL.Text, 'value' : IDL.Nat8 }),
    'NotAGasMode' : IDL.Nat8,
    'UnsupportedVersion' : IDL.Nat8,
    'EmptyText' : IDL.Record({ 'field' : IDL.Text }),
    'TrailingBytes' : IDL.Record({ 'len' : IDL.Nat64, 'consumed' : IDL.Nat64 }),
    'Truncated' : IDL.Record({
      'at' : IDL.Nat64,
      'len' : IDL.Nat64,
      'field' : IDL.Text,
      'wanted' : IDL.Nat64,
    }),
    'AmountTooLarge' : IDL.Record({ 'field' : IDL.Text }),
  });
  const TransitionError = IDL.Variant({
    'NoUnsignedNonce' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
    }),
    'FundsChainNotTheQuotes' : IDL.Record({
      'logged' : IDL.Nat64,
      'quoted' : IDL.Nat64,
    }),
    'CannotAskWhileRefunding' : IDL.Null,
    'NonceNeverAllocated' : IDL.Record({
      'next' : IDL.Nat64,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
    'WaitingForUser' : IDL.Null,
    'NotRefunding' : SwapStatus,
    'Pocket' : PocketError,
    'Flow' : IDL.Text,
    'Pool' : IDL.Text,
    'SwapExists' : IDL.Vec(IDL.Nat8),
    'AttemptStillOpen' : IDL.Nat32,
    'Books' : IDL.Text,
    'UnknownSwap' : IDL.Vec(IDL.Nat8),
    'NonceStillUnsigned' : IDL.Vec(IDL.Nat8),
    'NotExecuting' : SwapStatus,
    'NoOpenAttempt' : IDL.Vec(IDL.Nat8),
    'QuoteHashMismatch' : IDL.Record({
      'computed' : IDL.Vec(IDL.Nat8),
      'declared' : IDL.Vec(IDL.Nat8),
    }),
    'UnparseableQuote' : QuoteError,
    'NonceOutOfSequence' : IDL.Record({
      'expected' : IDL.Nat64,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
    'NonceExhausted' : IDL.Record({ 'chain_id' : IDL.Nat64 }),
    'SwapClosed' : SwapStatus,
    'FeesOverflow' : IDL.Null,
    'AttemptOutOfSequence' : IDL.Record({
      'attempt' : IDL.Nat32,
      'expected' : IDL.Opt(IDL.Nat32),
    }),
    'NonceNotUnsigned' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
    'AmountOutOfRange' : IDL.Nat,
    'AttemptNotOpen' : IDL.Nat32,
    'CannotStartRefund' : SwapStatus,
    'NotInFlight' : SwapStatus,
    'NotWaitingForUser' : SwapStatus,
    'FeeAlreadyAccrued' : IDL.Vec(IDL.Nat8),
    'FundsTokenNotTheQuotes' : IDL.Record({
      'logged' : IDL.Text,
      'quoted' : IDL.Text,
    }),
    'FundsAmountNotTheQuotes' : IDL.Record({
      'logged' : IDL.Nat,
      'quoted' : IDL.Nat,
    }),
    'AlreadyPaid' : IDL.Null,
    'UnknownPocket' : IDL.Nat64,
    'NonceNotHeldForPull' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
  });
  const ReplayError = IDL.Variant({
    'OutOfSequence' : IDL.Record({
      'found' : IDL.Nat64,
      'expected' : IDL.Nat64,
    }),
    'LogFull' : IDL.Record({ 'index' : IDL.Nat64 }),
    'Refused' : IDL.Record({ 'error' : TransitionError, 'index' : IDL.Nat64 }),
    'Unlinked' : IDL.Record({
      'head' : IDL.Vec(IDL.Nat8),
      'index' : IDL.Nat64,
      'parent' : IDL.Vec(IDL.Nat8),
    }),
  });
  const AuditProgress = IDL.Record({
    'matches' : IDL.Bool,
    'finished' : IDL.Bool,
    'halted' : IDL.Bool,
    'remaining' : IDL.Nat64,
    'folded_so_far' : IDL.Nat64,
    'refused' : IDL.Opt(ReplayError),
  });
  const Role = IDL.Variant({ 'Quoter' : IDL.Null, 'Watcher' : IDL.Null });
  const GuardError = IDL.Variant({
    'NotController' : IDL.Null,
    'RolesNotSet' : IDL.Null,
    'CallerNotRole' : Role,
    'CallerNotWatcherOrController' : IDL.Null,
    'CallerNotQuoterWatcherOrController' : IDL.Null,
    'CallerNotQuoterOrWatcher' : IDL.Null,
    'Halted' : IDL.Null,
    'RoleNotSet' : Role,
  });
  const Result = IDL.Variant({ 'Ok' : AuditProgress, 'Err' : GuardError });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const BookLines = IDL.Record({
    'checked_at_ns' : IDL.Opt(IDL.Nat64),
    'unattributed' : IDL.Nat,
    'observed' : IDL.Opt(IDL.Nat),
    'checked_at_block' : IDL.Opt(IDL.Nat64),
    'pool' : IDL.Nat,
    'surplus' : IDL.Opt(IDL.Int),
    'fee_income' : IDL.Nat,
    'in_flight' : IDL.Nat,
    'failed_at_ns' : IDL.Opt(IDL.Nat64),
  });
  const EcdsaError = IDL.Variant({
    'NoParityRecovers' : IDL.Null,
    'UnreadableSignature' : IDL.Null,
    'UnreadablePublicKey' : IDL.Null,
    'Signature' : IDL.Record({ 'message' : IDL.Text }),
    'PublicKey' : IDL.Record({ 'message' : IDL.Text }),
  });
  const SignError = IDL.Variant({ 'Guard' : GuardError, 'Ecdsa' : EcdsaError });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : SignError });
  const Choice = IDL.Variant({ 'Requote' : IDL.Null, 'Refund' : IDL.Null });
  const TxPurpose = IDL.Variant({
    'Continue' : IDL.Vec(IDL.Nat8),
    'PoolPayout' : IDL.Nat64,
    'Payout' : IDL.Vec(IDL.Nat8),
    'Burn' : IDL.Vec(IDL.Nat8),
    'Mint' : IDL.Vec(IDL.Nat8),
    'Refund' : IDL.Vec(IDL.Nat8),
    'EcoRescue' : IDL.Vec(IDL.Nat8),
    'GaslessPull' : IDL.Vec(IDL.Nat8),
    'PoolApprove' : IDL.Null,
    'Relay' : IDL.Vec(IDL.Nat8),
    'PoolTransfer' : IDL.Vec(IDL.Nat8),
    'PoolMove' : IDL.Nat64,
    'Finish' : IDL.Vec(IDL.Nat8),
    'Cancel' : IDL.Nat64,
    'Reclaim' : IDL.Vec(IDL.Nat8),
  });
  const EventType = IDL.Variant({
    'PocketFunded' : IDL.Record({ 'chain_id' : IDL.Nat64, 'amount' : IDL.Nat }),
    'PaidInStable' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'amount' : IDL.Nat,
    }),
    'PullSigned' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
      'raw_tx' : IDL.Vec(IDL.Nat8),
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
    'FundsReceived' : IDL.Record({
      'token' : IDL.Text,
      'quote_bytes' : IDL.Vec(IDL.Nat8),
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'tx_ref' : IDL.Text,
      'amount' : IDL.Nat,
    }),
    'PocketReleased' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'amount' : IDL.Nat,
    }),
    'Refunded' : IDL.Record({
      'to' : IDL.Text,
      'token' : IDL.Text,
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'amount' : IDL.Nat,
    }),
    'TxSigned' : IDL.Record({
      'attempt' : IDL.Nat32,
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'raw_tx' : IDL.Vec(IDL.Nat8),
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
    'Flow' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'step' : IDL.Text,
      'detail' : IDL.Text,
      'step_bytes' : IDL.Vec(IDL.Nat8),
    }),
    'TxCancelled' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
      'raw_tx' : IDL.Vec(IDL.Nat8),
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
    'Pool' : IDL.Record({
      'step' : IDL.Text,
      'detail' : IDL.Text,
      'step_bytes' : IDL.Vec(IDL.Nat8),
    }),
    'Books' : IDL.Record({
      'step' : IDL.Text,
      'detail' : IDL.Text,
      'step_bytes' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
    }),
    'SwapDone' : IDL.Record({ 'quote_hash' : IDL.Vec(IDL.Nat8) }),
    'TxFailed' : IDL.Record({
      'attempt' : IDL.Nat32,
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'reason' : IDL.Text,
    }),
    'PocketRebalanced' : IDL.Record({
      'to_chain' : IDL.Nat64,
      'from_chain' : IDL.Nat64,
      'amount' : IDL.Nat,
      'route' : IDL.Text,
    }),
    'RefundStarted' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'reason' : IDL.Text,
    }),
    'DecisionRequired' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'reason' : IDL.Text,
    }),
    'RolesChanged' : IDL.Record({ 'watcher' : IDL.Text, 'quoter' : IDL.Text }),
    'WaitingRepaired' : IDL.Record({ 'quote_hash' : IDL.Vec(IDL.Nat8) }),
    'FeeAccrued' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'amount' : IDL.Nat,
    }),
    'TxConfirmed' : IDL.Record({
      'attempt' : IDL.Nat32,
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'block' : IDL.Nat64,
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
    'DecisionMade' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'choice' : Choice,
    }),
    'ConfigChanged' : IDL.Record({ 'json' : IDL.Text }),
    'TxCreated' : IDL.Record({
      'to' : IDL.Text,
      'max_priority_fee_wei_per_gas' : IDL.Nat,
      'action' : IDL.Opt(IDL.Text),
      'data' : IDL.Vec(IDL.Nat8),
      'max_fee_wei_per_gas' : IDL.Nat,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
      'value_wei' : IDL.Nat,
      'gas_limit' : IDL.Nat,
      'purpose' : TxPurpose,
    }),
    'Frozen' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'reason' : IDL.Text,
    }),
    'TxReplaced' : IDL.Record({
      'max_priority_fee_wei_per_gas' : IDL.Nat,
      'max_fee_wei_per_gas' : IDL.Nat,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
      'raw_tx' : IDL.Vec(IDL.Nat8),
      'tx_hash' : IDL.Vec(IDL.Nat8),
      'purpose' : TxPurpose,
    }),
    'PocketReserved' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'amount' : IDL.Nat,
    }),
    'PocketSpent' : IDL.Record({
      'quote_hash' : IDL.Vec(IDL.Nat8),
      'chain_id' : IDL.Nat64,
      'amount' : IDL.Nat,
    }),
  });
  const Event = IDL.Record({
    'hash' : IDL.Vec(IDL.Nat8),
    'index' : IDL.Nat64,
    'time_ns' : IDL.Nat64,
    'payload' : EventType,
    'parent_hash' : IDL.Vec(IDL.Nat8),
  });
  const Recipe = IDL.Record({
    'scaler' : IDL.Opt(IDL.Text),
    'data' : IDL.Vec(IDL.Nat8),
    'target' : IDL.Text,
  });
  const ChainData = IDL.Record({
    'base_fee_wei_per_gas' : IDL.Nat,
    'block' : IDL.Nat64,
    'priority_fee_wei_per_gas' : IDL.Nat,
  });
  const Result_3 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text });
  const ChainDataEntry = IDL.Record({
    'data' : ChainData,
    'pushed_at_ns' : IDL.Nat64,
  });
  const Result_4 = IDL.Variant({ 'Ok' : Config, 'Err' : GuardError });
  const FlowView = IDL.Record({
    'status' : IDL.Text,
    'tx_block' : IDL.Opt(IDL.Nat64),
    'withdrawal_id' : IDL.Opt(IDL.Nat64),
    'held' : IDL.Nat,
    'kind' : IDL.Text,
    'failed_continuations' : IDL.Nat32,
    'chain_id' : IDL.Opt(IDL.Nat64),
    'held_ledger' : IDL.Opt(IDL.Principal),
    'delivered' : IDL.Opt(IDL.Nat),
    'tx_hash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'tx_open' : IDL.Bool,
    'continuation_action' : IDL.Opt(IDL.Nat8),
    'landed_tx' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'eth_held' : IDL.Nat,
    'reason' : IDL.Opt(IDL.Text),
  });
  const FlowSettings = IDL.Record({
    'cketh_ledger' : IDL.Opt(IDL.Principal),
    'cketh_fee_allowance' : IDL.Nat,
    'max_gas_limit' : IDL.Nat64,
    'continuation_deadline_s' : IDL.Nat64,
    'icp_enabled' : IDL.Opt(IDL.Bool),
    'ck_minter' : IDL.Opt(IDL.Principal),
    'ckusdc_ledger' : IDL.Opt(IDL.Principal),
    'eco_prover' : IDL.Opt(IDL.Text),
    'relay_window_s' : IDL.Nat64,
    'icpswap_pools' : IDL.Vec(IDL.Principal),
    'ethereum_usdc' : IDL.Opt(IDL.Text),
    'ethereum_chain_id' : IDL.Nat64,
    'ck_helper' : IDL.Opt(IDL.Text),
  });
  const IcpRouteVia = IDL.Variant({
    'Icp' : IDL.Principal,
    'Direct' : IDL.Principal,
  });
  const IcpRoute = IDL.Record({
    'via' : IcpRouteVia,
    'ledger' : IDL.Principal,
  });
  const IcpRoutesView = IDL.Record({
    'icp_ckusdc_pool' : IDL.Opt(IDL.Principal),
    'routes' : IDL.Vec(IcpRoute),
  });
  const PoolArrivalOutcome = IDL.Variant({
    'Credited' : IDL.Record({ 'ref' : IDL.Vec(IDL.Nat8), 'amount' : IDL.Nat }),
    'Unattributed' : IDL.Record({ 'why' : IDL.Text, 'amount' : IDL.Nat }),
  });
  const PoolError = IDL.Variant({
    'NotDeep' : IDL.Record({ 'have' : IDL.Nat64, 'needed' : IDL.Nat64 }),
    'Sanctioned' : IDL.Text,
    'TokenNotListed' : IDL.Principal,
    'NotAllowed' : IDL.Text,
    'Closed' : IDL.Text,
    'AlreadyCredited' : IDL.Null,
    'AboveTvlCap' : IDL.Record({ 'cap' : IDL.Nat, 'would_be' : IDL.Nat }),
    'AboveSwapCap' : IDL.Record({ 'cap' : IDL.Nat }),
    'Known' : IDL.Null,
    'BadRef' : IDL.Null,
    'Unknown' : IDL.Null,
    'Ledger' : IDL.Text,
    'BadSettings' : IDL.Text,
    'Unavailable' : IDL.Text,
    'BadArrival' : IDL.Text,
    'Halted' : IDL.Null,
    'PremiumTooLow' : IDL.Record({ 'least' : IDL.Nat }),
    'Expired' : IDL.Null,
    'ShortShares' : IDL.Record({ 'have' : IDL.Nat, 'need' : IDL.Nat }),
  });
  const Result_5 = IDL.Variant({
    'Ok' : PoolArrivalOutcome,
    'Err' : PoolError,
  });
  const IcpAccount = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const PoolAccount = IDL.Variant({ 'Evm' : IDL.Text, 'Icp' : IcpAccount });
  const PoolDepositKind = IDL.Variant({
    'Stake' : IDL.Record({ 'owner' : PoolAccount }),
    'Swap' : IDL.Record({
      'min_out' : IDL.Nat,
      'recipient' : IcpAccount,
      'token_out' : IDL.Principal,
    }),
  });
  const PoolTerms = IDL.Record({
    'premium' : IDL.Nat,
    'kind' : PoolDepositKind,
    'icp_fees' : IDL.Nat,
    'salt' : IDL.Vec(IDL.Nat8),
    'rebalance_share' : IDL.Nat,
  });
  const PoolArrival = IDL.Record({
    'terms' : PoolTerms,
    'base_tx' : IDL.Vec(IDL.Nat8),
    'src_chain' : IDL.Nat64,
    'src_tx' : IDL.Vec(IDL.Nat8),
  });
  const PayPayoutOk = IDL.Record({ 'tx_id' : IDL.Nat64 });
  const Result_6 = IDL.Variant({ 'Ok' : PayPayoutOk, 'Err' : PoolError });
  const PayoutStatus = IDL.Variant({
    'Queued' : IDL.Null,
    'Refunding' : IDL.Text,
    'Failed' : IDL.Text,
    'Delivering' : IDL.Null,
    'Paid' : IDL.Null,
    'Pulling' : IDL.Null,
    'Swapping' : IDL.Null,
    'Undone' : IDL.Text,
    'Waiting' : IDL.Null,
    'Signed' : IDL.Nat64,
  });
  const PayoutTerms = IDL.Record({
    'dst_chain' : IDL.Nat64,
    'min_out' : IDL.Nat,
    'recipient' : IDL.Text,
    'deadline_ns' : IDL.Nat64,
    'token_out' : IDL.Text,
  });
  const PayoutKind = IDL.Variant({
    'IcpSwap' : IDL.Null,
    'Withdrawal' : IDL.Null,
  });
  const PayoutView = IDL.Record({
    'id' : IDL.Nat64,
    'status' : PayoutStatus,
    'terms' : PayoutTerms,
    'kind' : PayoutKind,
    'planned' : IDL.Opt(IDL.Nat),
    'order_id' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'tx_hash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'amount' : IDL.Opt(IDL.Nat),
    'received' : IDL.Opt(IDL.Nat),
  });
  const PayoutSettings = IDL.Record({
    'min_network_fee' : IDL.Nat,
    'cctp_min_network_fee' : IDL.Opt(IDL.Nat),
    'order_wait_s' : IDL.Nat64,
    'max_payout_gas' : IDL.Nat64,
    'rebalance_share_floor_bps' : IDL.Nat16,
  });
  const PayoutWaiting = IDL.Record({
    'id' : IDL.Nat64,
    'terms' : PayoutTerms,
    'kind' : PayoutKind,
    'amount' : IDL.Nat,
    'network_fee' : IDL.Opt(IDL.Nat),
  });
  const PoolAccountView = IDL.Record({
    'value_usdc' : IDL.Nat,
    'shares' : IDL.Nat,
  });
  const PoolDepositStatus = IDL.Variant({
    'Arrived' : IDL.Null,
    'Paying' : IDL.Null,
    'Refunded' : IDL.Null,
    'Paid' : IDL.Null,
    'Unattributed' : IDL.Null,
    'PayoutFailed' : IDL.Text,
    'Registered' : IDL.Null,
    'Expired' : IDL.Null,
  });
  const PoolRail = IDL.Variant({
    'Eco' : IDL.Null,
    'Cctp' : IDL.Null,
    'SameChain' : IDL.Null,
  });
  const PoolDepositView = IDL.Record({
    'ref' : IDL.Vec(IDL.Nat8),
    'status' : PoolDepositStatus,
    'shares_minted' : IDL.Opt(IDL.Nat),
    'base_tx' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'premium' : IDL.Nat,
    'arrived' : IDL.Opt(IDL.Nat),
    'kind' : PoolDepositKind,
    'paid' : IDL.Opt(IDL.Nat),
    'rail' : PoolRail,
    'min_usdc' : IDL.Nat,
    'src_chain' : IDL.Nat64,
    'payout_block' : IDL.Opt(IDL.Nat64),
    'rebalance_share' : IDL.Nat,
  });
  const OrphanView = IDL.Record({
    'key' : IDL.Vec(IDL.Nat8),
    'why' : IDL.Text,
    'block' : IDL.Nat64,
    'payer' : IDL.Opt(IDL.Text),
    'amount' : IDL.Nat,
  });
  const IcpTokenEntry = IDL.Record({
    'ledger' : IDL.Principal,
    'icpswap_pool' : IDL.Principal,
  });
  const PoolSettings = IDL.Record({
    'per_swap_cap' : IDL.Nat,
    'ckusdc_ledger' : IDL.Principal,
    'premium_bps' : IDL.Nat16,
    'tvl_cap' : IDL.Nat,
    'icp_tokens' : IDL.Vec(IcpTokenEntry),
    'large_deposit_confirmations' : IDL.Opt(IDL.Nat64),
    'pool_open_for_swaps' : IDL.Bool,
    'arrival_backup_s' : IDL.Nat64,
    'large_deposit_usdc' : IDL.Opt(IDL.Nat),
  });
  const PocketView = IDL.Record({
    'free' : IDL.Nat,
    'reserved' : IDL.Nat,
    'in_flight' : IDL.Nat,
  });
  const PoolStateView = IDL.Record({
    'icp' : PocketView,
    'per_swap_cap' : IDL.Nat,
    'base' : PocketView,
    'open' : IDL.Bool,
    'total_shares' : IDL.Nat,
    'premium_bps' : IDL.Nat16,
    'tvl_cap' : IDL.Nat,
    'total_assets' : IDL.Nat,
    'closed_reason' : IDL.Opt(IDL.Text),
  });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : PoolError });
  const ChainDataError = IDL.Variant({
    'FeeTooLarge' : IDL.Record({ 'field' : IDL.Text }),
  });
  const PushChainDataError = IDL.Variant({
    'Guard' : GuardError,
    'InvalidData' : ChainDataError,
  });
  const Result_8 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : PushChainDataError });
  const MoveStatus = IDL.Variant({
    'Routed' : IDL.Null,
    'Arrived' : IDL.Null,
    'Burned' : IDL.Null,
    'Stuck' : IDL.Text,
    'Open' : IDL.Null,
    'Landed' : IDL.Null,
    'Signed' : IDL.Nat64,
  });
  const MoveDirection = IDL.Variant({
    'IcpToBase' : IDL.Null,
    'BaseToIcp' : IDL.Null,
  });
  const MoveView = IDL.Record({
    'id' : IDL.Nat64,
    'ref' : IDL.Vec(IDL.Nat8),
    'status' : MoveStatus,
    'direction' : MoveDirection,
    'arrived' : IDL.Opt(IDL.Nat),
    'own_route_cost' : IDL.Nat,
    'opened_at_ns' : IDL.Nat64,
    'window_ends_ns' : IDL.Opt(IDL.Nat64),
    'urgent' : IDL.Bool,
    'amount' : IDL.Nat,
  });
  const RebalanceSettings = IDL.Record({
    'max_move' : IDL.Nat,
    'standard_when_idle' : IDL.Bool,
    'daily_cap' : IDL.Nat,
    'proposal_window_s' : IDL.Nat64,
    'min_move' : IDL.Nat,
    'band_bps' : IDL.Nat16,
    'target_icp_bps' : IDL.Nat16,
    'max_proposal_fee_bps' : IDL.Nat16,
  });
  const RelayStatus = IDL.Variant({
    'Failed' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'block' : IDL.Nat64,
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
    'Confirmed' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'block' : IDL.Nat64,
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
    'Signed' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'tx_hash' : IDL.Vec(IDL.Nat8),
    }),
  });
  const Result_9 = IDL.Variant({ 'Ok' : PayPayoutOk, 'Err' : IDL.Text });
  const DepositResolution = IDL.Variant({
    'Refund' : IDL.Null,
    'MarkPaid' : IDL.Record({ 'block' : IDL.Nat64 }),
    'Retry' : IDL.Null,
  });
  const MoveResolution = IDL.Variant({ 'Lost' : IDL.Text, 'Retry' : IDL.Null });
  const OrphanAction = IDL.Variant({
    'Book' : IDL.Null,
    'Refund' : IDL.Record({ 'to' : IDL.Text }),
  });
  const PayoutResolution = IDL.Variant({
    'Refund' : IDL.Null,
    'MarkPaid' : IDL.Null,
  });
  const StakeResolution = IDL.Variant({
    'NotPulled' : IDL.Null,
    'Pulled' : IDL.Record({ 'block' : IDL.Nat64 }),
  });
  const EvmAddressError = IDL.Variant({
    'BadChecksum' : IDL.Null,
    'WrongLength' : IDL.Record({ 'len' : IDL.Nat64 }),
    'NoPrefix' : IDL.Null,
    'NotHex' : IDL.Null,
  });
  const ConfigError = IDL.Variant({
    'EcdsaKeyNameFixed' : IDL.Record({
      'requested' : IDL.Text,
      'current' : IDL.Text,
    }),
    'EmptyEcdsaKeyName' : IDL.Null,
    'LookbackShorterThanClaims' : IDL.Record({
      'needed_blocks' : IDL.Nat64,
      'span_s' : IDL.Nat64,
      'lookback_blocks' : IDL.Nat32,
    }),
    'MaxFeeAboveHundredPercent' : IDL.Nat16,
    'VaultAddressTooLong' : IDL.Record({
      'len' : IDL.Nat64,
      'chain_id' : IDL.Nat64,
    }),
    'CapOutOfRange' : IDL.Record({
      'cap' : IDL.Nat32,
      'field' : IDL.Text,
      'ceiling' : IDL.Nat32,
    }),
    'TimerIntervalTooShort' : IDL.Record({
      'field' : IDL.Text,
      'interval_s' : IDL.Nat64,
      'floor_s' : IDL.Nat64,
    }),
    'PlatformFeeAboveMax' : IDL.Record({
      'max_fee_bps' : IDL.Nat16,
      'platform_fee_bps' : IDL.Nat16,
    }),
    'EmptyVaultAddress' : IDL.Record({ 'chain_id' : IDL.Nat64 }),
    'NotAnAddress' : IDL.Record({
      'field' : IDL.Text,
      'chain_id' : IDL.Opt(IDL.Nat64),
      'reason' : EvmAddressError,
    }),
    'DepthTooShallow' : IDL.Record({
      'floor' : IDL.Nat64,
      'chain_id' : IDL.Nat64,
      'depth' : IDL.Nat64,
    }),
    'RedactedRpcUrl' : IDL.Record({ 'chain_id' : IDL.Nat64 }),
    'DurationBelowFloor' : IDL.Record({
      'field' : IDL.Text,
      'duration_ms' : IDL.Nat64,
      'floor_ms' : IDL.Nat64,
    }),
    'TimerIntervalTooLong' : IDL.Record({
      'field' : IDL.Text,
      'interval_s' : IDL.Nat64,
    }),
    'CctpMinFeeTooHigh' : IDL.Record({
      'ceiling' : IDL.Nat32,
      'min_fee' : IDL.Nat32,
      'chain_id' : IDL.Nat64,
    }),
    'DurationAboveCap' : IDL.Record({
      'field' : IDL.Text,
      'cap_ms' : IDL.Nat64,
      'duration_ms' : IDL.Nat64,
    }),
    'AmountTooLarge' : IDL.Record({ 'field' : IDL.Text }),
    'DurationTooLong' : IDL.Record({ 'field' : IDL.Text }),
    'EmptyRpcUrl' : IDL.Record({ 'chain_id' : IDL.Nat64 }),
  });
  const CanonicalError = IDL.Variant({
    'TooLong' : IDL.Record({ 'len' : IDL.Nat64 }),
    'AmountTooLarge' : IDL.Nat,
  });
  const AppendError = IDL.Variant({
    'ChainDiverged' : IDL.Record({
      'log_head' : IDL.Vec(IDL.Nat8),
      'state_head' : IDL.Vec(IDL.Nat8),
    }),
    'LogFull' : IDL.Null,
    'Transition' : TransitionError,
    'IndexMismatch' : IDL.Record({
      'sealed' : IDL.Nat64,
      'log_len' : IDL.Nat64,
    }),
    'Canonical' : CanonicalError,
    'OutOfStableMemory' : IDL.Record({
      'current_pages' : IDL.Nat64,
      'delta_pages' : IDL.Nat64,
    }),
  });
  const SetConfigError = IDL.Variant({
    'InvalidConfig' : ConfigError,
    'Guard' : GuardError,
    'Append' : AppendError,
  });
  const Result_10 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : SetConfigError });
  const FlowCallError = IDL.Variant({
    'Invalid' : IDL.Text,
    'Guard' : GuardError,
    'Refused' : IDL.Text,
    'Unavailable' : IDL.Text,
  });
  const Result_11 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : FlowCallError });
  const Result_12 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : GuardError });
  const SetRolesError = IDL.Variant({
    'Guard' : GuardError,
    'AnonymousRole' : Role,
    'Append' : AppendError,
  });
  const Result_13 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : SetRolesError });
  const SetSanctionedError = IDL.Variant({
    'TextTooLong' : IDL.Record({
      'len' : IDL.Nat64,
      'list' : IDL.Text,
      'index' : IDL.Nat64,
    }),
    'Guard' : GuardError,
    'SetFull' : IDL.Record({ 'capacity' : IDL.Nat64 }),
  });
  const Result_14 = IDL.Variant({
    'Ok' : IDL.Nat64,
    'Err' : SetSanctionedError,
  });
  const ChainRef = IDL.Variant({ 'Evm' : IDL.Nat64, 'Solana' : IDL.Null });
  const SignedTx = IDL.Record({
    'id' : IDL.Nat64,
    'raw' : IDL.Vec(IDL.Nat8),
    'hash' : IDL.Vec(IDL.Nat8),
    'chain' : ChainRef,
    'signed_at_ns' : IDL.Nat64,
  });
  const StakeIcpArgs = IDL.Record({
    'owner' : PoolAccount,
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'amount' : IDL.Nat,
  });
  const StakeIcpOk = IDL.Record({ 'shares' : IDL.Nat });
  const Result_15 = IDL.Variant({ 'Ok' : StakeIcpOk, 'Err' : PoolError });
  const PayoutPlan = IDL.Record({
    'order' : IDL.Vec(IDL.Nat8),
    'gas_limit' : IDL.Nat64,
  });
  const IcpSwapTerms = IDL.Record({
    'token_in' : IDL.Principal,
    'plan' : PayoutPlan,
    'slippage_bps' : IDL.Nat16,
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'refund_to' : IDL.Opt(IcpAccount),
    'deadline_ns' : IDL.Nat64,
    'amount_in' : IDL.Nat,
  });
  const SwapFromIcpOk = IDL.Record({
    'id' : IDL.Nat64,
    'status' : PayoutStatus,
  });
  const Result_16 = IDL.Variant({ 'Ok' : SwapFromIcpOk, 'Err' : PoolError });
  const EvmWithdrawal = IDL.Record({
    'staker' : IDL.Text,
    'max_shares' : IDL.Nat,
    'usdc' : IDL.Nat,
    'nonce' : IDL.Nat64,
    'rebalance_share' : IDL.Nat,
    'network_fee' : IDL.Nat,
    'payout' : PayoutTerms,
  });
  const WithdrawEvmOk = IDL.Record({ 'id' : IDL.Nat64, 'burned' : IDL.Nat });
  const Result_17 = IDL.Variant({ 'Ok' : WithdrawEvmOk, 'Err' : PoolError });
  const WithdrawIcpArgs = IDL.Record({
    'to' : IcpAccount,
    'max_shares' : IDL.Nat,
    'from' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'min_out' : IDL.Nat,
    'usdc' : IDL.Nat,
    'token_out' : IDL.Principal,
  });
  const WithdrawIcpOk = IDL.Record({ 'paid' : IDL.Nat, 'burned' : IDL.Nat });
  const Result_18 = IDL.Variant({ 'Ok' : WithdrawIcpOk, 'Err' : PoolError });
  return IDL.Service({
    'audit_replay_step' : IDL.Func([IDL.Nat64], [Result], []),
    'book_surplus' : IDL.Func([IDL.Nat64, IDL.Nat], [Result_1], []),
    'books' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, BookLines))],
        ['query'],
      ),
    'derive_evm_address' : IDL.Func([], [Result_2], []),
    'event_count' : IDL.Func([], [IDL.Nat64], ['query']),
    'events_page' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(Event)],
        ['query'],
      ),
    'evm_address' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'finish_cctp' : IDL.Func(
        [
          IDL.Nat64,
          IDL.Vec(IDL.Nat8),
          IDL.Vec(IDL.Nat8),
          IDL.Opt(Recipe),
          IDL.Vec(IDL.Nat8),
          IDL.Nat64,
          IDL.Opt(ChainData),
        ],
        [Result_3],
        [],
      ),
    'get_chain_data' : IDL.Func(
        [IDL.Nat64],
        [IDL.Opt(ChainDataEntry)],
        ['query'],
      ),
    'get_config' : IDL.Func([], [Config], ['query']),
    'get_config_full' : IDL.Func([], [Result_4], ['query']),
    'get_flow' : IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Opt(FlowView)], ['query']),
    'get_flow_settings' : IDL.Func([], [FlowSettings], ['query']),
    'halted' : IDL.Func([], [IDL.Bool], ['query']),
    'icp_routes' : IDL.Func([], [IcpRoutesView], ['query']),
    'note_move_arrival' : IDL.Func(
        [IDL.Nat64, IDL.Vec(IDL.Nat8), IDL.Nat64, IDL.Vec(IDL.Nat8)],
        [Result_5],
        [],
      ),
    'note_pool_arrival' : IDL.Func([PoolArrival], [Result_5], []),
    'pay_payout' : IDL.Func(
        [IDL.Nat64, IDL.Vec(IDL.Nat8), IDL.Nat64],
        [Result_6],
        [],
      ),
    'payout' : IDL.Func([IDL.Nat64], [IDL.Opt(PayoutView)], ['query']),
    'payout_settings' : IDL.Func([], [PayoutSettings], ['query']),
    'payouts_waiting' : IDL.Func([], [IDL.Vec(PayoutWaiting)], ['query']),
    'pool_account' : IDL.Func([PoolAccount], [PoolAccountView], ['query']),
    'pool_approve_ck_helper' : IDL.Func([], [Result_6], []),
    'pool_approve_swapic' : IDL.Func([IDL.Nat64], [Result_6], []),
    'pool_deposit' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [IDL.Opt(PoolDepositView)],
        ['query'],
      ),
    'pool_orphans' : IDL.Func([], [IDL.Vec(OrphanView)], ['query']),
    'pool_settings' : IDL.Func([], [PoolSettings], ['query']),
    'pool_state' : IDL.Func([], [PoolStateView], ['query']),
    'propose_rebalance' : IDL.Func(
        [IDL.Nat64, IDL.Vec(IDL.Nat8), IDL.Nat64],
        [Result_7],
        [],
      ),
    'push_chain_data' : IDL.Func([IDL.Nat64, ChainData], [Result_8], []),
    'rebalance_moves' : IDL.Func([], [IDL.Vec(MoveView)], ['query']),
    'rebalance_settings' : IDL.Func([], [RebalanceSettings], ['query']),
    'rebalance_stuck' : IDL.Func([], [IDL.Vec(MoveView)], ['query']),
    'relay_gasless' : IDL.Func(
        [
          IDL.Nat64,
          IDL.Vec(IDL.Nat8),
          IDL.Vec(IDL.Nat8),
          IDL.Nat64,
          IDL.Opt(ChainData),
        ],
        [Result_3],
        [],
      ),
    'relay_status' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [IDL.Opt(RelayStatus)],
        ['query'],
      ),
    'rescue_eco_intent' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_9], []),
    'resolve_deposit' : IDL.Func(
        [IDL.Vec(IDL.Nat8), DepositResolution],
        [Result_7],
        [],
      ),
    'resolve_move' : IDL.Func([IDL.Nat64, MoveResolution], [Result_7], []),
    'resolve_orphan' : IDL.Func(
        [IDL.Vec(IDL.Nat8), OrphanAction],
        [Result_7],
        [],
      ),
    'resolve_payout' : IDL.Func([IDL.Nat64, PayoutResolution], [Result_7], []),
    'resolve_stake' : IDL.Func(
        [IDL.Vec(IDL.Nat8), StakeResolution],
        [Result_7],
        [],
      ),
    'set_config' : IDL.Func([Config], [Result_10], []),
    'set_flow_settings' : IDL.Func([FlowSettings], [Result_11], []),
    'set_halted' : IDL.Func([IDL.Bool], [Result_12], []),
    'set_icp_routes' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Vec(IcpRoute)],
        [Result_7],
        [],
      ),
    'set_payout_settings' : IDL.Func([PayoutSettings], [Result_7], []),
    'set_pool_paused' : IDL.Func([IDL.Bool], [Result_1], []),
    'set_pool_settings' : IDL.Func([PoolSettings], [Result_7], []),
    'set_rebalance_settings' : IDL.Func([RebalanceSettings], [Result_7], []),
    'set_roles' : IDL.Func([IDL.Principal, IDL.Principal], [Result_13], []),
    'set_sanctioned' : IDL.Func(
        [IDL.Vec(IDL.Text), IDL.Vec(IDL.Text)],
        [Result_14],
        [],
      ),
    'signed_txs' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(SignedTx)],
        ['query'],
      ),
    'stake_icp' : IDL.Func([StakeIcpArgs], [Result_15], []),
    'swap_from_icp' : IDL.Func([IcpSwapTerms], [Result_16], []),
    'verify_chain' : IDL.Func([], [IDL.Bool], ['query']),
    'verify_replay' : IDL.Func([], [IDL.Bool], ['query']),
    'version' : IDL.Func([], [IDL.Text], ['query']),
    'withdraw_evm' : IDL.Func(
        [EvmWithdrawal, IDL.Vec(IDL.Nat8)],
        [Result_17],
        [],
      ),
    'withdraw_icp' : IDL.Func([WithdrawIcpArgs], [Result_18], []),
  });
};
export const init = ({ IDL }) => {
  const ActionAmounts = IDL.Record({
    'relay_local' : IDL.Nat,
    'complete_ck' : IDL.Nat,
    'relay_cctp' : IDL.Nat,
    'pool_transfer' : IDL.Opt(IDL.Nat),
    'relay_deliver' : IDL.Nat,
    'complete_swap' : IDL.Nat,
    'pool_move' : IDL.Opt(IDL.Nat),
    'release' : IDL.Nat,
    'pool_ck_deposit' : IDL.Opt(IDL.Nat),
    'pool_approve' : IDL.Opt(IDL.Nat),
    'eco_rescue' : IDL.Opt(IDL.Nat),
    'pool_payout' : IDL.Opt(IDL.Nat),
    'relay_eco' : IDL.Nat,
    'pool_move_finish' : IDL.Opt(IDL.Nat),
  });
  const ActionGas = IDL.Record({
    'relay_local' : IDL.Nat64,
    'complete_ck' : IDL.Nat64,
    'relay_cctp' : IDL.Nat64,
    'pool_transfer' : IDL.Opt(IDL.Nat64),
    'relay_deliver' : IDL.Nat64,
    'complete_swap' : IDL.Nat64,
    'pool_move' : IDL.Opt(IDL.Nat64),
    'release' : IDL.Nat64,
    'pool_ck_deposit' : IDL.Opt(IDL.Nat64),
    'pool_approve' : IDL.Opt(IDL.Nat64),
    'eco_rescue' : IDL.Opt(IDL.Nat64),
    'pool_payout' : IDL.Opt(IDL.Nat64),
    'relay_eco' : IDL.Nat64,
    'pool_move_finish' : IDL.Opt(IDL.Nat64),
  });
  const EvmChainConfig = IDL.Record({
    'cctp_receiver' : IDL.Text,
    'token_messenger' : IDL.Text,
    'runner' : IDL.Text,
    'usdc' : IDL.Text,
    'min_network_fee' : ActionAmounts,
    'gas_budget_wei' : ActionAmounts,
    'gas_limit' : ActionGas,
    'swapic' : IDL.Text,
    'message_transmitter' : IDL.Text,
  });
  const Config = IDL.Record({
    'confirmations' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64)),
    'audit_chunk_events' : IDL.Nat32,
    'rail_status_max_age_s' : IDL.Nat64,
    'expiry_check_interval_s' : IDL.Nat64,
    'batch_window_ms' : IDL.Nat64,
    'max_refunds_per_sweep' : IDL.Nat32,
    'ecdsa_key_name' : IDL.Text,
    'max_fee_bps' : IDL.Nat16,
    'pool_chain' : IDL.Opt(IDL.Nat64),
    'rpc_urls' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'books_check_interval_s' : IDL.Nat64,
    'simulate_before_sign' : IDL.Bool,
    'vault_addresses' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'eco_enabled' : IDL.Bool,
    'platform_fee_bps' : IDL.Nat16,
    'permit_deadline_s' : IDL.Nat64,
    'cctp_domains' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'cctp_min_fees' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'evm_chains' : IDL.Vec(IDL.Tuple(IDL.Nat64, EvmChainConfig)),
    'replay_audit_interval_s' : IDL.Nat64,
    'books_tolerance' : IDL.Nat,
    'quote_ttl_s' : IDL.Nat64,
    'eco_portal' : IDL.Opt(IDL.Text),
    'decision_timeout_min' : IDL.Nat64,
    'credit_confirmations' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64))),
    'usdc_addresses' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'chain_data_max_age_s' : IDL.Nat64,
    'max_swap_usd' : IDL.Nat,
    'max_batch_items' : IDL.Nat32,
    'claim_grace_s' : IDL.Nat64,
    'max_evictions_per_sweep' : IDL.Nat32,
    'deposit_lookback_blocks' : IDL.Nat32,
  });
  const InitArg = IDL.Record({
    'watcher' : IDL.Principal,
    'config' : Config,
    'quoter' : IDL.Principal,
  });
  return [InitArg];
};

export const idlFactory = ({ IDL }) => {
  const AcrossFeeConfig = IDL.Record({
    'least_ppm' : IDL.Nat32,
    'most_ppm' : IDL.Nat32,
    'gas_allowance_usd6' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64)),
  });
  const AcrossPinsConfig = IDL.Record({
    'swap_proxy' : IDL.Text,
    'periphery' : IDL.Text,
    'spoke_pool' : IDL.Text,
    'multicall_handler' : IDL.Text,
  });
  const ActionAmounts = IDL.Record({
    'relay_local' : IDL.Nat,
    'complete_ck' : IDL.Nat,
    'relay_cctp' : IDL.Nat,
    'pool_transfer' : IDL.Opt(IDL.Nat),
    'relay_deliver' : IDL.Nat,
    'complete_swap' : IDL.Nat,
    'pool_move' : IDL.Opt(IDL.Nat),
    'release' : IDL.Nat,
    'across_claim' : IDL.Opt(IDL.Nat),
    'sweep' : IDL.Opt(IDL.Nat),
    'pool_ck_deposit' : IDL.Opt(IDL.Nat),
    'pool_approve' : IDL.Opt(IDL.Nat),
    'eco_rescue' : IDL.Opt(IDL.Nat),
    'relay_across' : IDL.Opt(IDL.Nat),
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
    'across_claim' : IDL.Opt(IDL.Nat64),
    'sweep' : IDL.Opt(IDL.Nat64),
    'pool_ck_deposit' : IDL.Opt(IDL.Nat64),
    'pool_approve' : IDL.Opt(IDL.Nat64),
    'eco_rescue' : IDL.Opt(IDL.Nat64),
    'relay_across' : IDL.Opt(IDL.Nat64),
    'pool_payout' : IDL.Opt(IDL.Nat64),
    'relay_eco' : IDL.Nat64,
    'pool_move_finish' : IDL.Opt(IDL.Nat64),
  });
  const EvmChainConfig = IDL.Record({
    'across' : IDL.Opt(AcrossPinsConfig),
    'cctp_receiver' : IDL.Text,
    'token_messenger' : IDL.Text,
    'runner' : IDL.Text,
    'usdc' : IDL.Text,
    'usdc_domain_version' : IDL.Opt(IDL.Text),
    'usdc_decimals' : IDL.Opt(IDL.Nat8),
    'min_network_fee' : ActionAmounts,
    'usdc_domain_name' : IDL.Opt(IDL.Text),
    'gas_budget_wei' : ActionAmounts,
    'gas_limit' : ActionGas,
    'swapic' : IDL.Text,
    'block_time_ms' : IDL.Nat64,
    'message_transmitter' : IDL.Text,
  });
  const Config = IDL.Record({
    'across_integrator' : IDL.Opt(IDL.Text),
    'confirmations' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64)),
    'batch_window_ms' : IDL.Nat64,
    'ecdsa_key_name' : IDL.Text,
    'pool_chain' : IDL.Opt(IDL.Nat64),
    'rpc_urls' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'books_check_interval_s' : IDL.Nat64,
    'simulate_before_sign' : IDL.Bool,
    'backstop_interval_s' : IDL.Nat64,
    'across_fee' : IDL.Opt(AcrossFeeConfig),
    'eco_enabled' : IDL.Bool,
    'private_send_chains' : IDL.Opt(IDL.Vec(IDL.Nat64)),
    'finalized_chains' : IDL.Opt(IDL.Vec(IDL.Nat64)),
    'cctp_domains' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'cctp_min_fees' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'evm_chains' : IDL.Vec(IDL.Tuple(IDL.Nat64, EvmChainConfig)),
    'books_tolerance' : IDL.Nat,
    'eco_portal' : IDL.Opt(IDL.Text),
    'credit_confirmations' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64))),
    'max_batch_items' : IDL.Nat32,
  });
  const InitArg = IDL.Record({
    'watcher' : IDL.Principal,
    'config' : Config,
    'quoter' : IDL.Principal,
  });
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
  const AcrossFillCheck = IDL.Variant({
    'TooSoon' : IDL.Record({ 'again_at_s' : IDL.Nat64 }),
    'Paid' : IDL.Null,
    'NotDelivering' : IDL.Null,
    'NotYet' : IDL.Record({ 'again_at_s' : IDL.Nat64 }),
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
  const Result = IDL.Variant({ 'Ok' : AcrossFillCheck, 'Err' : PoolError });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text });
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
  const EcdsaError = IDL.Variant({
    'NoParityRecovers' : IDL.Null,
    'UnreadableSignature' : IDL.Null,
    'UnreadablePublicKey' : IDL.Null,
    'Signature' : IDL.Record({ 'message' : IDL.Text }),
    'PublicKey' : IDL.Record({ 'message' : IDL.Text }),
  });
  const SignError = IDL.Variant({ 'Guard' : GuardError, 'Ecdsa' : EcdsaError });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : SignError });
  const IcpAccount = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const SweepTarget = IDL.Variant({
    'Evm' : IDL.Record({ 'to' : IDL.Text, 'chain_id' : IDL.Nat64 }),
    'Icp' : IcpAccount,
  });
  const SweepAsset = IDL.Variant({
    'Icp' : IDL.Null,
    'FeeUsdc' : IDL.Null,
    'CkUsdcFees' : IDL.Null,
    'Native' : IDL.Null,
    'CkEth' : IDL.Null,
  });
  const TxOutcome = IDL.Variant({
    'Reverted' : IDL.Record({ 'block' : IDL.Nat64 }),
    'Succeeded' : IDL.Record({ 'block' : IDL.Nat64 }),
    'Cancelled' : IDL.Null,
  });
  const TxPurpose = IDL.Variant({
    'PoolPayout' : IDL.Nat64,
    'Sweep' : IDL.Nat64,
    'EcoRescue' : IDL.Vec(IDL.Nat8),
    'AcrossClaim' : IDL.Nat64,
    'PoolApprove' : IDL.Null,
    'Relay' : IDL.Vec(IDL.Nat8),
    'PoolTransfer' : IDL.Vec(IDL.Nat8),
    'PoolMove' : IDL.Nat64,
    'Finish' : IDL.Vec(IDL.Nat8),
    'Cancel' : IDL.Nat64,
  });
  const EventType = IDL.Variant({
    'Swept' : IDL.Record({
      'id' : IDL.Nat64,
      'to' : SweepTarget,
      'asset' : SweepAsset,
      'from_fee_income' : IDL.Nat,
      'from_pool_fees' : IDL.Nat,
      'amount' : IDL.Nat,
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
    'TxFinal' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
      'tx_hash' : IDL.Vec(IDL.Nat8),
      'outcome' : TxOutcome,
      'purpose' : TxPurpose,
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
    'SweepReverted' : IDL.Record({ 'id' : IDL.Nat64, 'why' : IDL.Text }),
    'RolesChanged' : IDL.Record({ 'watcher' : IDL.Text, 'quoter' : IDL.Text }),
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
    'TxReplaced' : IDL.Record({
      'max_priority_fee_wei_per_gas' : IDL.Nat,
      'max_fee_wei_per_gas' : IDL.Nat,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
      'raw_tx' : IDL.Vec(IDL.Nat8),
      'tx_hash' : IDL.Vec(IDL.Nat8),
      'purpose' : TxPurpose,
    }),
  });
  const Event = IDL.Record({
    'index' : IDL.Nat64,
    'time_ns' : IDL.Nat64,
    'payload' : EventType,
  });
  const ChainFees = IDL.Record({
    'user_paid' : IDL.Nat,
    'held' : IDL.Nat,
    'swept' : IDL.Nat,
    'chain_id' : IDL.Nat64,
  });
  const FeesView = IDL.Record({
    'pool_base' : IDL.Nat,
    'pool_base_swept' : IDL.Nat,
    'chains' : IDL.Vec(ChainFees),
    'pool_icp' : IDL.Nat,
    'pool_icp_swept' : IDL.Nat,
  });
  const FinalizedSeen = IDL.Record({
    'stalled' : IDL.Bool,
    'moved_at_ns' : IDL.Nat64,
    'number' : IDL.Opt(IDL.Nat64),
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
  const Result_3 = IDL.Variant({ 'Ok' : Config, 'Err' : GuardError });
  const FlowSettings = IDL.Record({
    'cketh_ledger' : IDL.Opt(IDL.Principal),
    'cketh_fee_allowance' : IDL.Nat,
    'ck_minter' : IDL.Opt(IDL.Principal),
    'eco_prover' : IDL.Opt(IDL.Text),
    'relay_window_s' : IDL.Nat64,
    'ck_helper' : IDL.Opt(IDL.Text),
  });
  const IcpRouteVia = IDL.Variant({
    'Hub' : IDL.Record({ 'hub' : IDL.Principal, 'pool' : IDL.Principal }),
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
  const SupportedStandard = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
  const ConsentMessageMetadata = IDL.Record({
    'utc_offset_minutes' : IDL.Opt(IDL.Int16),
    'language' : IDL.Text,
  });
  const DeviceSpec = IDL.Variant({
    'GenericDisplay' : IDL.Null,
    'FieldsDisplay' : IDL.Null,
  });
  const ConsentMessageSpec = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'device_spec' : IDL.Opt(DeviceSpec),
  });
  const ConsentMessageRequest = IDL.Record({
    'arg' : IDL.Vec(IDL.Nat8),
    'method' : IDL.Text,
    'user_preferences' : ConsentMessageSpec,
  });
  const TextValue = IDL.Record({ 'content' : IDL.Text });
  const TimestampSeconds = IDL.Record({ 'amount' : IDL.Nat64 });
  const Value = IDL.Variant({
    'Text' : TextValue,
    'TimestampSeconds' : TimestampSeconds,
  });
  const FieldsDisplay = IDL.Record({
    'fields' : IDL.Vec(IDL.Tuple(IDL.Text, Value)),
    'intent' : IDL.Text,
  });
  const ConsentMessage = IDL.Variant({
    'FieldsDisplayMessage' : FieldsDisplay,
    'GenericDisplayMessage' : IDL.Text,
  });
  const ConsentInfo = IDL.Record({
    'metadata' : ConsentMessageMetadata,
    'consent_message' : ConsentMessage,
  });
  const ErrorInfo = IDL.Record({ 'description' : IDL.Text });
  const Icrc21Error = IDL.Variant({
    'UnsupportedCanisterCall' : ErrorInfo,
    'ConsentMessageUnavailable' : ErrorInfo,
  });
  const ConsentMessageResponse = IDL.Variant({
    'Ok' : ConsentInfo,
    'Err' : Icrc21Error,
  });
  const PoolArrivalOutcome = IDL.Variant({
    'Credited' : IDL.Record({ 'ref' : IDL.Vec(IDL.Nat8), 'amount' : IDL.Nat }),
    'Unattributed' : IDL.Record({ 'why' : IDL.Text, 'amount' : IDL.Nat }),
  });
  const Result_4 = IDL.Variant({
    'Ok' : PoolArrivalOutcome,
    'Err' : PoolError,
  });
  const PoolArrival = IDL.Record({
    'base_tx' : IDL.Vec(IDL.Nat8),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'src_chain' : IDL.Nat64,
    'src_tx' : IDL.Vec(IDL.Nat8),
  });
  const PayPayoutOk = IDL.Record({ 'tx_id' : IDL.Nat64 });
  const Result_5 = IDL.Variant({ 'Ok' : PayPayoutOk, 'Err' : PoolError });
  const PayoutStatus = IDL.Variant({
    'Queued' : IDL.Null,
    'Refunding' : IDL.Text,
    'Failed' : IDL.Text,
    'Delivering' : IDL.Null,
    'CkWithdrawing' : IDL.Null,
    'Paid' : IDL.Null,
    'Pulling' : IDL.Null,
    'Swapping' : IDL.Null,
    'CkWithdrawn' : IDL.Null,
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
    'ck_amount' : IDL.Opt(IDL.Nat),
    'order_id' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'ck_withdrawal_id' : IDL.Opt(IDL.Nat64),
    'tx_hash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'amount' : IDL.Opt(IDL.Nat),
    'received' : IDL.Opt(IDL.Nat),
  });
  const CkSettings = IDL.Record({
    'open' : IDL.Bool,
    'min_network_fee' : IDL.Nat,
    'ck_swap_fee_allowance' : IDL.Nat,
  });
  const PayoutSettings = IDL.Record({
    'ck' : IDL.Opt(CkSettings),
    'across_in_flight_max' : IDL.Opt(IDL.Nat),
    'min_network_fee' : IDL.Nat,
    'order_wait_s' : IDL.Nat64,
    'cctp_payouts' : IDL.Bool,
    'max_payout_gas' : IDL.Nat64,
  });
  const PayoutWaiting = IDL.Record({
    'id' : IDL.Nat64,
    'terms' : PayoutTerms,
    'kind' : PayoutKind,
    'amount' : IDL.Nat,
    'network_fee' : IDL.Opt(IDL.Nat),
  });
  const PoolAccount = IDL.Variant({ 'Evm' : IDL.Text, 'Icp' : IcpAccount });
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
  const PoolDepositKind = IDL.Variant({
    'Stake' : IDL.Record({ 'owner' : PoolAccount }),
    'Swap' : IDL.Record({
      'min_out' : IDL.Nat,
      'recipient' : IcpAccount,
      'token_out' : IDL.Principal,
    }),
  });
  const PoolRail = IDL.Variant({
    'Eco' : IDL.Null,
    'Cctp' : IDL.Null,
    'Across' : IDL.Null,
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
    'move_fee' : IDL.Nat,
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
    'least_move_fee_base_to_icp' : IDL.Opt(IDL.Nat),
    'large_deposit_confirmations' : IDL.Opt(IDL.Nat64),
    'pool_open_for_swaps' : IDL.Bool,
    'arrival_backup_s' : IDL.Nat64,
    'pool_fee' : IDL.Opt(IDL.Nat),
    'large_deposit_usdc' : IDL.Opt(IDL.Nat),
    'least_move_fee_icp_to_base' : IDL.Opt(IDL.Nat),
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
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : PoolError });
  const PullToCheck = IDL.Record({
    'why' : IDL.Text,
    'at_ns' : IDL.Nat64,
    'from' : IcpAccount,
    'memo' : IDL.Vec(IDL.Nat8),
    'what' : IDL.Text,
    'ledger' : IDL.Principal,
    'amount' : IDL.Nat,
  });
  const Result_7 = IDL.Variant({
    'Ok' : IDL.Vec(PullToCheck),
    'Err' : IDL.Text,
  });
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
  const Result_8 = IDL.Variant({ 'Ok' : PayPayoutOk, 'Err' : IDL.Text });
  const CkResolution = IDL.Variant({
    'Delivered' : IDL.Record({ 'tx_hash' : IDL.Vec(IDL.Nat8) }),
    'Retry' : IDL.Null,
    'Reimbursed' : IDL.Null,
  });
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
    'Retry' : IDL.Null,
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
    'NotAnIntegratorId' : IDL.Null,
    'AcrossFeeOutOfRange' : IDL.Record({
      'least_ppm' : IDL.Nat32,
      'most_ppm' : IDL.Nat32,
    }),
    'BlockTimeOutOfRange' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'block_time_ms' : IDL.Nat64,
    }),
    'CapOutOfRange' : IDL.Record({
      'cap' : IDL.Nat32,
      'field' : IDL.Text,
      'ceiling' : IDL.Nat32,
    }),
    'UsdcDecimalsOutOfRange' : IDL.Record({
      'decimals' : IDL.Nat8,
      'chain_id' : IDL.Nat64,
    }),
    'NotDomainText' : IDL.Record({
      'field' : IDL.Text,
      'chain_id' : IDL.Nat64,
    }),
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
    'NotFinalizable' : IDL.Record({ 'chain_id' : IDL.Nat64 }),
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
  const TransitionError = IDL.Variant({
    'NonceNeverAllocated' : IDL.Record({
      'next' : IDL.Nat64,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
    'Flow' : IDL.Text,
    'Pool' : IDL.Text,
    'Books' : IDL.Text,
    'NonceStillUnsigned' : IDL.Vec(IDL.Nat8),
    'NonceOutOfSequence' : IDL.Record({
      'expected' : IDL.Nat64,
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
    'NonceExhausted' : IDL.Record({ 'chain_id' : IDL.Nat64 }),
    'NonceNotUnsigned' : IDL.Record({
      'chain_id' : IDL.Nat64,
      'nonce' : IDL.Nat64,
    }),
  });
  const AppendError = IDL.Variant({
    'LogFull' : IDL.Null,
    'Transition' : TransitionError,
    'IndexMismatch' : IDL.Record({
      'sealed' : IDL.Nat64,
      'log_len' : IDL.Nat64,
    }),
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
  const Result_9 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : SetConfigError });
  const FlowCallError = IDL.Variant({
    'Invalid' : IDL.Text,
    'Guard' : GuardError,
    'Refused' : IDL.Text,
    'Unavailable' : IDL.Text,
  });
  const Result_10 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : FlowCallError });
  const Result_11 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : GuardError });
  const Result_12 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
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
    'move_fee' : IDL.Nat,
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
  const CkSwapTerms = IDL.Record({
    'token_in' : IDL.Principal,
    'dst_chain' : IDL.Nat64,
    'min_out' : IDL.Nat,
    'recipient' : IDL.Text,
    'min_usdc' : IDL.Nat,
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'refund_to' : IDL.Opt(IcpAccount),
    'deadline_ns' : IDL.Nat64,
    'amount_in' : IDL.Nat,
    'token_out' : IDL.Text,
    'network_fee' : IDL.Nat,
  });
  const EvmSweepAsset = IDL.Variant({
    'FeeUsdc' : IDL.Null,
    'Native' : IDL.Null,
  });
  const SweepEvmArgs = IDL.Record({
    'to' : IDL.Text,
    'asset' : EvmSweepAsset,
    'chain_id' : IDL.Nat64,
    'amount' : IDL.Nat,
  });
  const SweepEvmOk = IDL.Record({ 'id' : IDL.Nat64, 'tx_id' : IDL.Nat64 });
  const SweepError = IDL.Variant({
    'Invalid' : IDL.Text,
    'Sanctioned' : IDL.Null,
    'Busy' : IDL.Text,
    'Guard' : GuardError,
    'AboveBooks' : IDL.Record({ 'available' : IDL.Nat }),
    'Ledger' : IDL.Text,
    'Unavailable' : IDL.Text,
  });
  const Result_17 = IDL.Variant({ 'Ok' : SweepEvmOk, 'Err' : SweepError });
  const IcpSweepAsset = IDL.Variant({
    'Icp' : IDL.Null,
    'CkUsdcFees' : IDL.Null,
    'CkEth' : IDL.Null,
  });
  const SweepIcpArgs = IDL.Record({
    'to' : IcpAccount,
    'asset' : IcpSweepAsset,
    'amount' : IDL.Nat,
  });
  const SweepIcpOk = IDL.Record({ 'id' : IDL.Nat64, 'block' : IDL.Nat });
  const Result_18 = IDL.Variant({ 'Ok' : SweepIcpOk, 'Err' : SweepError });
  const EvmWithdrawal = IDL.Record({
    'staker' : IDL.Text,
    'max_shares' : IDL.Nat,
    'usdc' : IDL.Nat,
    'nonce' : IDL.Nat64,
    'network_fee' : IDL.Nat,
    'payout' : PayoutTerms,
    'move_fee' : IDL.Nat,
  });
  const WithdrawEvmOk = IDL.Record({ 'id' : IDL.Nat64, 'burned' : IDL.Nat });
  const Result_19 = IDL.Variant({ 'Ok' : WithdrawEvmOk, 'Err' : PoolError });
  const WithdrawIcpArgs = IDL.Record({
    'to' : IcpAccount,
    'max_shares' : IDL.Nat,
    'from' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'min_out' : IDL.Nat,
    'usdc' : IDL.Nat,
    'token_out' : IDL.Principal,
    'move_fee' : IDL.Nat,
  });
  const WithdrawIcpOk = IDL.Record({ 'paid' : IDL.Nat, 'burned' : IDL.Nat });
  const Result_20 = IDL.Variant({ 'Ok' : WithdrawIcpOk, 'Err' : PoolError });
  return IDL.Service({
    'books' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, BookLines))],
        ['query'],
      ),
    'check_across_fill' : IDL.Func([IDL.Nat64], [Result], []),
    'claim_across_refund' : IDL.Func([IDL.Nat64], [Result_1], []),
    'derive_evm_address' : IDL.Func([], [Result_2], []),
    'event_count' : IDL.Func([], [IDL.Nat64], ['query']),
    'events_page' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(Event)],
        ['query'],
      ),
    'evm_address' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'fees' : IDL.Func([], [FeesView], ['query']),
    'finalized_seen' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, FinalizedSeen))],
        ['query'],
      ),
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
        [Result_1],
        [],
      ),
    'get_config' : IDL.Func([], [Config], ['query']),
    'get_config_full' : IDL.Func([], [Result_3], ['query']),
    'get_flow_settings' : IDL.Func([], [FlowSettings], ['query']),
    'halted' : IDL.Func([], [IDL.Bool], ['query']),
    'icp_routes' : IDL.Func([], [IcpRoutesView], ['query']),
    'icrc10_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(SupportedStandard)],
        ['query'],
      ),
    'icrc21_canister_call_consent_message' : IDL.Func(
        [ConsentMessageRequest],
        [ConsentMessageResponse],
        [],
      ),
    'note_move_arrival' : IDL.Func(
        [IDL.Nat64, IDL.Vec(IDL.Nat8), IDL.Nat64, IDL.Vec(IDL.Nat8)],
        [Result_4],
        [],
      ),
    'note_pool_arrival' : IDL.Func([PoolArrival], [Result_4], []),
    'pay_payout' : IDL.Func(
        [IDL.Nat64, IDL.Vec(IDL.Nat8), IDL.Nat64, IDL.Opt(ChainData)],
        [Result_5],
        [],
      ),
    'payout' : IDL.Func([IDL.Nat64], [IDL.Opt(PayoutView)], ['query']),
    'payout_settings' : IDL.Func([], [PayoutSettings], ['query']),
    'payouts_waiting' : IDL.Func([], [IDL.Vec(PayoutWaiting)], ['query']),
    'pool_account' : IDL.Func([PoolAccount], [PoolAccountView], ['query']),
    'pool_approve_ck_helper' : IDL.Func([], [Result_5], []),
    'pool_approve_swapic' : IDL.Func([IDL.Nat64], [Result_5], []),
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
        [Result_6],
        [],
      ),
    'pulls_to_check' : IDL.Func([], [Result_7], ['query']),
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
        [Result_1],
        [],
      ),
    'rescue_eco_intent' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_8], []),
    'resolve_ck_withdrawal' : IDL.Func(
        [IDL.Nat64, CkResolution],
        [Result_6],
        [],
      ),
    'resolve_deposit' : IDL.Func(
        [IDL.Vec(IDL.Nat8), DepositResolution],
        [Result_6],
        [],
      ),
    'resolve_move' : IDL.Func([IDL.Nat64, MoveResolution], [Result_6], []),
    'resolve_orphan' : IDL.Func(
        [IDL.Vec(IDL.Nat8), OrphanAction],
        [Result_6],
        [],
      ),
    'resolve_payout' : IDL.Func([IDL.Nat64, PayoutResolution], [Result_6], []),
    'resolve_stake' : IDL.Func(
        [IDL.Vec(IDL.Nat8), StakeResolution],
        [Result_6],
        [],
      ),
    'set_config' : IDL.Func([Config], [Result_9], []),
    'set_flow_settings' : IDL.Func([FlowSettings], [Result_10], []),
    'set_halted' : IDL.Func([IDL.Bool], [Result_11], []),
    'set_icp_routes' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Vec(IcpRoute)],
        [Result_6],
        [],
      ),
    'set_payout_settings' : IDL.Func([PayoutSettings], [Result_6], []),
    'set_pool_paused' : IDL.Func([IDL.Bool], [Result_12], []),
    'set_pool_settings' : IDL.Func([PoolSettings], [Result_6], []),
    'set_rebalance_settings' : IDL.Func([RebalanceSettings], [Result_6], []),
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
    'swap_from_icp_ck' : IDL.Func([CkSwapTerms], [Result_16], []),
    'sweep_evm' : IDL.Func([SweepEvmArgs], [Result_17], []),
    'sweep_icp' : IDL.Func([SweepIcpArgs], [Result_18], []),
    'version' : IDL.Func([], [IDL.Text], ['query']),
    'watcher_cycles_balance' : IDL.Func([], [Result_1], ['query']),
    'withdraw_evm' : IDL.Func(
        [EvmWithdrawal, IDL.Vec(IDL.Nat8)],
        [Result_19],
        [],
      ),
    'withdraw_icp' : IDL.Func([WithdrawIcpArgs], [Result_20], []),
  });
};
export const init = ({ IDL }) => {
  const AcrossFeeConfig = IDL.Record({
    'least_ppm' : IDL.Nat32,
    'most_ppm' : IDL.Nat32,
    'gas_allowance_usd6' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64)),
  });
  const AcrossPinsConfig = IDL.Record({
    'swap_proxy' : IDL.Text,
    'periphery' : IDL.Text,
    'spoke_pool' : IDL.Text,
    'multicall_handler' : IDL.Text,
  });
  const ActionAmounts = IDL.Record({
    'relay_local' : IDL.Nat,
    'complete_ck' : IDL.Nat,
    'relay_cctp' : IDL.Nat,
    'pool_transfer' : IDL.Opt(IDL.Nat),
    'relay_deliver' : IDL.Nat,
    'complete_swap' : IDL.Nat,
    'pool_move' : IDL.Opt(IDL.Nat),
    'release' : IDL.Nat,
    'across_claim' : IDL.Opt(IDL.Nat),
    'sweep' : IDL.Opt(IDL.Nat),
    'pool_ck_deposit' : IDL.Opt(IDL.Nat),
    'pool_approve' : IDL.Opt(IDL.Nat),
    'eco_rescue' : IDL.Opt(IDL.Nat),
    'relay_across' : IDL.Opt(IDL.Nat),
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
    'across_claim' : IDL.Opt(IDL.Nat64),
    'sweep' : IDL.Opt(IDL.Nat64),
    'pool_ck_deposit' : IDL.Opt(IDL.Nat64),
    'pool_approve' : IDL.Opt(IDL.Nat64),
    'eco_rescue' : IDL.Opt(IDL.Nat64),
    'relay_across' : IDL.Opt(IDL.Nat64),
    'pool_payout' : IDL.Opt(IDL.Nat64),
    'relay_eco' : IDL.Nat64,
    'pool_move_finish' : IDL.Opt(IDL.Nat64),
  });
  const EvmChainConfig = IDL.Record({
    'across' : IDL.Opt(AcrossPinsConfig),
    'cctp_receiver' : IDL.Text,
    'token_messenger' : IDL.Text,
    'runner' : IDL.Text,
    'usdc' : IDL.Text,
    'usdc_domain_version' : IDL.Opt(IDL.Text),
    'usdc_decimals' : IDL.Opt(IDL.Nat8),
    'min_network_fee' : ActionAmounts,
    'usdc_domain_name' : IDL.Opt(IDL.Text),
    'gas_budget_wei' : ActionAmounts,
    'gas_limit' : ActionGas,
    'swapic' : IDL.Text,
    'block_time_ms' : IDL.Nat64,
    'message_transmitter' : IDL.Text,
  });
  const Config = IDL.Record({
    'across_integrator' : IDL.Opt(IDL.Text),
    'confirmations' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64)),
    'batch_window_ms' : IDL.Nat64,
    'ecdsa_key_name' : IDL.Text,
    'pool_chain' : IDL.Opt(IDL.Nat64),
    'rpc_urls' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Text)),
    'books_check_interval_s' : IDL.Nat64,
    'simulate_before_sign' : IDL.Bool,
    'backstop_interval_s' : IDL.Nat64,
    'across_fee' : IDL.Opt(AcrossFeeConfig),
    'eco_enabled' : IDL.Bool,
    'private_send_chains' : IDL.Opt(IDL.Vec(IDL.Nat64)),
    'finalized_chains' : IDL.Opt(IDL.Vec(IDL.Nat64)),
    'cctp_domains' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'cctp_min_fees' : IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat32)),
    'evm_chains' : IDL.Vec(IDL.Tuple(IDL.Nat64, EvmChainConfig)),
    'books_tolerance' : IDL.Nat,
    'eco_portal' : IDL.Opt(IDL.Text),
    'credit_confirmations' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Nat64, IDL.Nat64))),
    'max_batch_items' : IDL.Nat32,
  });
  const InitArg = IDL.Record({
    'watcher' : IDL.Principal,
    'config' : Config,
    'quoter' : IDL.Principal,
  });
  return [InitArg];
};

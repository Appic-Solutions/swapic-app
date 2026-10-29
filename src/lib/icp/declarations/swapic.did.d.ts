import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

/**
 * One amount per action the canister signs.
 */
export interface ActionAmounts {
  'relay_local' : bigint,
  'complete_ck' : bigint,
  'relay_cctp' : bigint,
  'pool_transfer' : [] | [bigint],
  'relay_deliver' : bigint,
  'complete_swap' : bigint,
  /**
   * The rebalancing's rows (P11c), optional as the pool's.
   */
  'pool_move' : [] | [bigint],
  'release' : bigint,
  'pool_ck_deposit' : [] | [bigint],
  'pool_approve' : [] | [bigint],
  /**
   * Eco's `cancelAndProve` of an unfilled intent (P11e), optional as the pool's.
   */
  'eco_rescue' : [] | [bigint],
  /**
   * The pool's rows (P11b), optional: an absent one refuses its action. Left out of the
   * ConfigChanged JSON when absent, so a config without them keeps its shape.
   */
  'pool_payout' : [] | [bigint],
  'relay_eco' : bigint,
  'pool_move_finish' : [] | [bigint],
}
/**
 * One gas limit per action the canister signs.
 */
export interface ActionGas {
  'relay_local' : bigint,
  'complete_ck' : bigint,
  'relay_cctp' : bigint,
  'pool_transfer' : [] | [bigint],
  'relay_deliver' : bigint,
  'complete_swap' : bigint,
  /**
   * The rebalancing's rows (P11c), optional as the pool's: a move's own order, its CCTP
   * finish (the limit the watcher finishes the canister's own move with), and a Base to
   * ICP Eco move's ck deposit on Ethereum.
   */
  'pool_move' : [] | [bigint],
  'release' : bigint,
  'pool_ck_deposit' : [] | [bigint],
  'pool_approve' : [] | [bigint],
  /**
   * Eco's `cancelAndProve` of an unfilled intent (P11e), optional as the pool's.
   */
  'eco_rescue' : [] | [bigint],
  /**
   * The pool's rows (P11b), optional: an absent one refuses its action. Left out of the
   * ConfigChanged JSON when absent, so a config without them keeps its shape.
   */
  'pool_payout' : [] | [bigint],
  'relay_eco' : bigint,
  'pool_move_finish' : [] | [bigint],
}
/**
 * Why an event was not appended. Nothing was written.
 */
export type AppendError = {
    'ChainDiverged' : {
      'log_head' : Uint8Array | number[],
      'state_head' : Uint8Array | number[],
    }
  } |
  { 'LogFull' : null } |
  { 'Transition' : TransitionError } |
  { 'IndexMismatch' : { 'sealed' : bigint, 'log_len' : bigint } } |
  { 'Canonical' : CanonicalError } |
  {
    'OutOfStableMemory' : { 'current_pages' : bigint, 'delta_pages' : bigint }
  };
/**
 * What one step of the deep check found.
 * 
 * `finished` is the field to read first: only a step that reached the head compared the
 * fold with the live one, and `matches` is its verdict. A step short of the head reports
 * how far the fold got and how much is left, and condemns nothing. An entry the fold
 * refuses, or a finished fold that differs, is a divergence and halts the canister; every
 * verdict starts the next audit over from genesis.
 */
export interface AuditProgress {
  /**
   * whether the fold is the live fold, which only a finished step says
   */
  'matches' : boolean,
  'finished' : boolean,
  /**
   * whether this step halted the canister
   */
  'halted' : boolean,
  /**
   * entries between the fold and the head, as the log stood when this step read it
   */
  'remaining' : bigint,
  /**
   * entries folded from genesis, this step's included
   */
  'folded_so_far' : bigint,
  /**
   * why the fold stopped, if it did
   */
  'refused' : [] | [ReplayError],
}
/**
 * One chain's book lines and its last balance check. `surplus` is `observed` minus what
 * the lines expect at that check; it is never booked by itself.
 */
export interface BookLines {
  /**
   * When the last check that read a balance was recorded, IC time in nanoseconds.
   */
  'checked_at_ns' : [] | [bigint],
  'unattributed' : bigint,
  'observed' : [] | [bigint],
  'checked_at_block' : [] | [bigint],
  'pool' : bigint,
  'surplus' : [] | [bigint],
  'fee_income' : bigint,
  'in_flight' : bigint,
  /**
   * When the last check that could not read the balance was recorded.
   */
  'failed_at_ns' : [] | [bigint],
}
/**
 * A value the canonical preimage has no bytes for.
 */
export type CanonicalError = { 'TooLong' : { 'len' : bigint } } |
  { 'AmountTooLarge' : bigint };
/**
 * One chain as the watcher last saw it. There is no instant on it: the canister stamps
 * what it receives, so nothing a caller sends can date its data forward.
 */
export interface ChainData {
  /**
   * The base fee of that block.
   */
  'base_fee_wei_per_gas' : bigint,
  /**
   * The head block the watcher saw.
   */
  'block' : bigint,
  /**
   * The tip to pay on top of the base fee.
   */
  'priority_fee_wei_per_gas' : bigint,
}
/**
 * A cached reading with the canister time it arrived at.
 */
export interface ChainDataEntry { 'data' : ChainData, 'pushed_at_ns' : bigint }
/**
 * Why a pushed reading is not one this canister prices gas with.
 */
export type ChainDataError = { 'FeeTooLarge' : { 'field' : string } };
/**
 * The chain a signed transaction is for.
 */
export type ChainRef = { 'Evm' : bigint } |
  { 'Solana' : null };
export type Choice = { 'Requote' : null } |
  { 'Refund' : null };
/**
 * Every knob the canister reads at runtime. Numbers are the spec defaults; the two
 * address maps and the key name are what a deploy fills in.
 */
export interface Config {
  'confirmations' : Array<[bigint, bigint]>,
  'audit_chunk_events' : number,
  'rail_status_max_age_s' : bigint,
  'expiry_check_interval_s' : bigint,
  'batch_window_ms' : bigint,
  'max_refunds_per_sweep' : number,
  'ecdsa_key_name' : string,
  'max_fee_bps' : number,
  /**
   * The chain the pool's EVM pocket is on, whose books the pool's guard reads. None:
   * the pool is closed.
   */
  'pool_chain' : [] | [bigint],
  'rpc_urls' : Array<[bigint, string]>,
  'books_check_interval_s' : bigint,
  /**
   * Whether the canister simulates a transaction itself before it signs it. False by
   * default: the watcher and the submit API simulate before they ask.
   */
  'simulate_before_sign' : boolean,
  'vault_addresses' : Array<[bigint, string]>,
  /**
   * Whether the Eco rail may be used. False until its route is designed: a quote
   * naming it is refused at registration and at the claim, and a swap already on it is
   * paused until the rail is on again (counted by `paused_swaps`).
   */
  'eco_enabled' : boolean,
  'platform_fee_bps' : number,
  'permit_deadline_s' : bigint,
  /**
   * CCTP's domain id per chain: Circle's own numbering, never a chain id.
   */
  'cctp_domains' : Array<[bigint, number]>,
  /**
   * The minimum fee each chain's `TokenMessengerV2` holds a burn from it to, as Circle
   * stores it (`minFee()`, in thousandths of a basis point, below 10,000,000). A chain
   * with no entry is one whose messenger charges none. Every burn offers at least this
   * much of its amount as its `maxFee`, the Standard path included.
   */
  'cctp_min_fees' : Array<[bigint, number]>,
  /**
   * Every EVM chain the canister signs on (design C). A chain with no entry signs
   * nothing.
   */
  'evm_chains' : Array<[bigint, EvmChainConfig]>,
  'replay_audit_interval_s' : bigint,
  /**
   * How far below what the books expect a balance may read, in micro-USDC, before the
   * pool pauses.
   */
  'books_tolerance' : bigint,
  'quote_ttl_s' : bigint,
  /**
   * Eco's `Portal`, the same address on every chain.
   */
  'eco_portal' : [] | [string],
  'decision_timeout_min' : bigint,
  /**
   * The crediting depth per chain: how deep money arriving at the canister (a deposit,
   * a ck minter withdrawal's USDC, the books' balance read) must be before it is
   * credited. Absent, or a chain with no entry: the chain's `confirmations`, the swap
   * depth. Ethereum's is refused below 12 (`DepthTooShallow`), and crediting there never
   * reads below 12 whatever is set.
   */
  'credit_confirmations' : [] | [Array<[bigint, bigint]>],
  /**
   * The USDC contract per chain, as an EVM address.
   */
  'usdc_addresses' : Array<[bigint, string]>,
  'chain_data_max_age_s' : bigint,
  'max_swap_usd' : bigint,
  'max_batch_items' : number,
  /**
   * How long after a quote's deposit deadline (its expiry plus the permit window) a
   * claim for a deposit that landed by that deadline is still admitted, from any
   * caller the claim admits, the controller included: 600 to 86,400 seconds, an hour by
   * default. The pending store keeps the quote until it ends.
   */
  'claim_grace_s' : bigint,
  'max_evictions_per_sweep' : number,
  /**
   * How many blocks back from a chain's head the deposit read looks for a user's
   * deposit: at most 400,000, the widest range the read walks, forty windows of ten
   * thousand blocks, and the default; and more than a claim may be asked after its
   * deposit at four blocks a second (the longest quote, `permit_deadline_s` and
   * `claim_grace_s`), which `LookbackShorterThanClaims` refuses.
   */
  'deposit_lookback_blocks' : number,
}
/**
 * Why a config was refused, naming the knob at fault.
 */
export type ConfigError = {
    /**
     * The canister has already derived its EVM address under the key name it holds, and
     * the Swapic contracts on every chain name that address.
     */
    'EcdsaKeyNameFixed' : { 'requested' : string, 'current' : string }
  } |
  { 'EmptyEcdsaKeyName' : null } |
  {
    /**
     * The v1 claim's rule, kept with its knobs: a claim could be asked `span_s` after the
     * deposit it read for (the longest quote lifetime, `permit_deadline_s` and
     * `claim_grace_s`), `needed_blocks` at four blocks a second, and
     * `deposit_lookback_blocks` does not reach that far back.
     */
    'LookbackShorterThanClaims' : {
      'needed_blocks' : bigint,
      'span_s' : bigint,
      'lookback_blocks' : number,
    }
  } |
  { 'MaxFeeAboveHundredPercent' : number } |
  { 'VaultAddressTooLong' : { 'len' : bigint, 'chain_id' : bigint } } |
  {
    'CapOutOfRange' : { 'cap' : number, 'field' : string, 'ceiling' : number }
  } |
  {
    'TimerIntervalTooShort' : {
      'field' : string,
      'interval_s' : bigint,
      'floor_s' : bigint,
    }
  } |
  {
    'PlatformFeeAboveMax' : {
      'max_fee_bps' : number,
      'platform_fee_bps' : number,
    }
  } |
  { 'EmptyVaultAddress' : { 'chain_id' : bigint } } |
  {
    /**
     * The text in `field` (for a table, at `chain_id`) is not an EVM address.
     */
    'NotAnAddress' : {
      'field' : string,
      'chain_id' : [] | [bigint],
      'reason' : EvmAddressError,
    }
  } |
  {
    /**
     * The crediting depth configured for `chain_id` (`credit_confirmations`) is below the
     * floor a reorg on that chain makes necessary, so money arriving there could be
     * credited and then leave the chain.
     */
    'DepthTooShallow' : {
      'floor' : bigint,
      'chain_id' : bigint,
      'depth' : bigint,
    }
  } |
  { 'RedactedRpcUrl' : { 'chain_id' : bigint } } |
  {
    /**
     * In milliseconds, like the cap: the knob is below the least it may be.
     */
    'DurationBelowFloor' : {
      'field' : string,
      'duration_ms' : bigint,
      'floor_ms' : bigint,
    }
  } |
  { 'TimerIntervalTooLong' : { 'field' : string, 'interval_s' : bigint } } |
  {
    /**
     * The minimum fee listed for `chain_id` is at or above `ceiling`, the whole amount in
     * Circle's units, which Circle's own setter refuses.
     */
    'CctpMinFeeTooHigh' : {
      'ceiling' : number,
      'min_fee' : number,
      'chain_id' : bigint,
    }
  } |
  {
    /**
     * In milliseconds, so the one knob set in milliseconds is reported as it was set.
     */
    'DurationAboveCap' : {
      'field' : string,
      'cap_ms' : bigint,
      'duration_ms' : bigint,
    }
  } |
  { 'AmountTooLarge' : { 'field' : string } } |
  { 'DurationTooLong' : { 'field' : string } } |
  { 'EmptyRpcUrl' : { 'chain_id' : bigint } };
/**
 * A controller's answer to a deposit held for a human (`resolve_deposit`): back to its
 * payout with fresh attempts, what arrived back to its payer on Base, or its transfer found
 * landed in ledger block `block`.
 */
export type DepositResolution = { 'Refund' : null } |
  { 'MarkPaid' : { 'block' : bigint } } |
  { 'Retry' : null };
/**
 * Why a key or a signature is not one this canister can use. A refused management call is
 * reported rather than trapped: the interface specification says a rejected signing
 * request may leave the signature in the system anyway, so a caller that retries has to
 * know it is retrying.
 */
export type EcdsaError = { 'NoParityRecovers' : null } |
  { 'UnreadableSignature' : null } |
  { 'UnreadablePublicKey' : null } |
  { 'Signature' : { 'message' : string } } |
  { 'PublicKey' : { 'message' : string } };
/**
 * One entry of the log. `time_ns` is IC time in nanoseconds.
 */
export interface Event {
  'hash' : Uint8Array | number[],
  'index' : bigint,
  'time_ns' : bigint,
  'payload' : EventType,
  'parent_hash' : Uint8Array | number[],
}
/**
 * What happened. The event hash is computed over a canonical encoding of the variant,
 * never over this candid layout.
 */
export type EventType = {
    'PocketFunded' : { 'chain_id' : bigint, 'amount' : bigint }
  } |
  {
    'PaidInStable' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'amount' : bigint,
    }
  } |
  {
    /**
     * A gasless pull was signed: the transaction that takes a user's funds into the vault
     * with their permit, recorded before it is broadcast. It names the quote and the nonce
     * and no swap, because the deposit it makes is what `claim_swap` then verifies.
     */
    'PullSigned' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'nonce' : bigint,
      'raw_tx' : Uint8Array | number[],
      'tx_hash' : Uint8Array | number[],
    }
  } |
  {
    'FundsReceived' : {
      'token' : string,
      'quote_bytes' : Uint8Array | number[],
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'tx_ref' : string,
      'amount' : bigint,
    }
  } |
  {
    'PocketReleased' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'amount' : bigint,
    }
  } |
  {
    'Refunded' : {
      'to' : string,
      'token' : string,
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'amount' : bigint,
    }
  } |
  {
    'TxSigned' : {
      'attempt' : number,
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'raw_tx' : Uint8Array | number[],
      'tx_hash' : Uint8Array | number[],
    }
  } |
  {
    /**
     * A step of a flow: a gasless relay, ICP to EVM, or EVM to ICP. `step` names it,
     * `detail` is a readable rendering, and `step_bytes` is the step exactly as the log
     * hashes it.
     */
    'Flow' : {
      'quote_hash' : Uint8Array | number[],
      'step' : string,
      'detail' : string,
      'step_bytes' : Uint8Array | number[],
    }
  } |
  {
    /**
     * A nonce that was allocated and never signed for was spent by a zero-value
     * self-transfer, so the chain is never left with a gap it cannot mine past.
     */
    'TxCancelled' : {
      'chain_id' : bigint,
      'nonce' : bigint,
      'raw_tx' : Uint8Array | number[],
      'tx_hash' : Uint8Array | number[],
    }
  } |
  {
    /**
     * A step of the pool, rendered and exactly as the log hashes it.
     */
    'Pool' : {
      'step' : string,
      'detail' : string,
      'step_bytes' : Uint8Array | number[],
    }
  } |
  {
    /**
     * A step of a chain's USDC books, rendered and exactly as the log hashes it.
     */
    'Books' : {
      'step' : string,
      'detail' : string,
      'step_bytes' : Uint8Array | number[],
      'chain_id' : bigint,
    }
  } |
  { 'SwapDone' : { 'quote_hash' : Uint8Array | number[] } } |
  {
    'TxFailed' : {
      'attempt' : number,
      'quote_hash' : Uint8Array | number[],
      'reason' : string,
    }
  } |
  {
    'PocketRebalanced' : {
      'to_chain' : bigint,
      'from_chain' : bigint,
      'amount' : bigint,
      'route' : string,
    }
  } |
  {
    'RefundStarted' : {
      'quote_hash' : Uint8Array | number[],
      'reason' : string,
    }
  } |
  {
    'DecisionRequired' : {
      'quote_hash' : Uint8Array | number[],
      'reason' : string,
    }
  } |
  {
    /**
     * Principals as text, so the audit line reads without a decoder.
     */
    'RolesChanged' : { 'watcher' : string, 'quoter' : string }
  } |
  {
    /**
     * A swap's waiting index entries were made to agree with the swap: what no event could
     * have produced was dropped, and the wait the swap is in is there. Only a divergence
     * needs one, so this line is the repair's explanation.
     */
    'WaitingRepaired' : { 'quote_hash' : Uint8Array | number[] }
  } |
  {
    'FeeAccrued' : { 'quote_hash' : Uint8Array | number[], 'amount' : bigint }
  } |
  {
    'TxConfirmed' : {
      'attempt' : number,
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'block' : bigint,
      'tx_hash' : Uint8Array | number[],
    }
  } |
  {
    'DecisionMade' : { 'quote_hash' : Uint8Array | number[], 'choice' : Choice }
  } |
  {
    /**
     * `json` is the public view of the config written: JSON of `Config` with every rpc url
     * as `"***"` and `max_swap_usd` as a decimal string.
     */
    'ConfigChanged' : { 'json' : string }
  } |
  {
    /**
     * A nonce was allocated to an outbound transaction, before the signature was asked
     * for. `to` is an EIP-55 address.
     */
    'TxCreated' : {
      'to' : string,
      'max_priority_fee_wei_per_gas' : bigint,
      /**
       * The gas action whose budget the transaction is held to (`relay_cctp`,
       * `complete_swap`, ...), on every line that records one.
       */
      'action' : [] | [string],
      'data' : Uint8Array | number[],
      'max_fee_wei_per_gas' : bigint,
      'chain_id' : bigint,
      'nonce' : bigint,
      'value_wei' : bigint,
      'gas_limit' : bigint,
      'purpose' : TxPurpose,
    }
  } |
  { 'Frozen' : { 'quote_hash' : Uint8Array | number[], 'reason' : string } } |
  {
    /**
     * An open transaction was re-sent at the same nonce with a higher fee, with the bytes
     * that were broadcast.
     */
    'TxReplaced' : {
      'max_priority_fee_wei_per_gas' : bigint,
      'max_fee_wei_per_gas' : bigint,
      'chain_id' : bigint,
      'nonce' : bigint,
      'raw_tx' : Uint8Array | number[],
      'tx_hash' : Uint8Array | number[],
      'purpose' : TxPurpose,
    }
  } |
  {
    'PocketReserved' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'amount' : bigint,
    }
  } |
  {
    'PocketSpent' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'amount' : bigint,
    }
  };
/**
 * Why a text is not an EVM address. Mirrors `types::evm::EvmAddressError` so a caller
 * replaying a log is told which of the four rules the text broke, rather than being told
 * something that is false for three of them.
 */
export type EvmAddressError = { 'BadChecksum' : null } |
  { 'WrongLength' : { 'len' : bigint } } |
  { 'NoPrefix' : null } |
  { 'NotHex' : null };
/**
 * One EVM chain as design C runs on it: its Swapic deployment, CCTP v2, its USDC, and per
 * action the gas limit, the gas budget and the least fee. Addresses are EVM addresses.
 */
export interface EvmChainConfig {
  /**
   * The mint recipient and destination caller of every Swap and CkDeposit arriving here.
   */
  'cctp_receiver' : string,
  /**
   * CCTP v2's `TokenMessengerV2`.
   */
  'token_messenger' : string,
  /**
   * The one shared Runner: it makes this chain's burns.
   */
  'runner' : string,
  'usdc' : string,
  /**
   * The least fee step, in USDC units, each action needs.
   */
  'min_network_fee' : ActionAmounts,
  /**
   * The most each action's transaction may cost in wei (`gas_limit * max_fee_per_gas`):
   * the gas rule. Above it the canister signs nothing and the caller tries again.
   */
  'gas_budget_wei' : ActionAmounts,
  /**
   * The most gas the canister gives each action's transaction. `relay_gasless` and
   * `finish_cctp` sign with exactly the limit they are given and refuse one above this,
   * but a release, which is signed at this when it is asked for more.
   */
  'gas_limit' : ActionGas,
  /**
   * The door users approve, and the EIP-712 verifying contract of every order here.
   */
  'swapic' : string,
  /**
   * CCTP v2's `MessageTransmitterV2`.
   */
  'message_transmitter' : string,
}
/**
 * An EVM staker's withdrawal, signed by the staker (EIP-712).
 */
export interface EvmWithdrawal {
  /**
   * The EVM address owning the shares, the EIP-712 signer.
   */
  'staker' : string,
  'max_shares' : bigint,
  /**
   * Micro USDC taken out of the pool (shares burned = `ceil(usdc * S / A)`).
   */
  'usdc' : bigint,
  /**
   * Once per staker.
   */
  'nonce' : bigint,
  /**
   * At least the canister's floor.
   */
  'rebalance_share' : bigint,
  'network_fee' : bigint,
  'payout' : PayoutTerms,
}
/**
 * Why a flow door refused. Nothing moved.
 */
export type FlowCallError = {
    /**
     * The request is not one the canister acts on: the field and the reason.
     */
    'Invalid' : string
  } |
  { 'Guard' : GuardError } |
  {
    /**
     * A rule refused it: the reason.
     */
    'Refused' : string
  } |
  {
    /**
     * A chain or a canister did not answer usably; the caller may try again.
     */
    'Unavailable' : string
  };
/**
 * What the flows read at runtime. Set by a controller; the canister's `Config` is the
 * chain layer's and stays as it was.
 */
export interface FlowSettings {
  /**
   * The ckETH ledger, when the minter charges the withdrawal's gas in ckETH: the
   * canister approves the minter for `cketh_fee_allowance` of it before a withdrawal.
   */
  'cketh_ledger' : [] | [Principal],
  'cketh_fee_allowance' : bigint,
  /**
   * The most gas a relay or a continuation may be given.
   */
  'max_gas_limit' : bigint,
  /**
   * How long the continuation's params stay valid on chain.
   */
  'continuation_deadline_s' : bigint,
  /**
   * Whether the ICP flows run: `register_icp_quote`, `start_icp_swap`,
   * `register_evm_quote` and their engine steps. They still speak router ABI v2, so
   * `true` is refused (`IcpFlowsNotOnV3`) until they move to ABI v3 with the pool (P11).
   */
  'icp_enabled' : [] | [boolean],
  /**
   * The ckETH minter, which withdraws ckERC20 tokens too.
   */
  'ck_minter' : [] | [Principal],
  'ckusdc_ledger' : [] | [Principal],
  /**
   * Eco's prover, the one a rebalance proposal's intent may name: an intent proven by
   * any other pays its reward to whoever that prover says (P11c).
   */
  'eco_prover' : [] | [string],
  /**
   * The furthest ahead a relayed quote's deadline may be.
   */
  'relay_window_s' : bigint,
  /**
   * The only ICPSwap pools a quote may name.
   */
  'icpswap_pools' : Array<Principal>,
  /**
   * USDC on that chain, which the withdrawal lands as.
   */
  'ethereum_usdc' : [] | [string],
  /**
   * The chain the ck minter withdraws to and the continuation runs on: Ethereum.
   */
  'ethereum_chain_id' : bigint,
  /**
   * The ck minter's ERC-20 deposit helper on Ethereum (`depositErc20` with subaccounts):
   * a Base to ICP rebalance move filled by Eco is deposited through it (P11c).
   */
  'ck_helper' : [] | [string],
}
/**
 * A flow as the fold holds it.
 */
export interface FlowView {
  'status' : string,
  'tx_block' : [] | [bigint],
  'withdrawal_id' : [] | [bigint],
  'held' : bigint,
  'kind' : string,
  'failed_continuations' : number,
  'chain_id' : [] | [bigint],
  'held_ledger' : [] | [Principal],
  'delivered' : [] | [bigint],
  'tx_hash' : [] | [Uint8Array | number[]],
  'tx_open' : boolean,
  'continuation_action' : [] | [number],
  'landed_tx' : [] | [Uint8Array | number[]],
  'eth_held' : bigint,
  'reason' : [] | [string],
}
/**
 * Why a caller was refused before anything ran. A refusal names the role and never a
 * principal.
 */
export type GuardError = { 'NotController' : null } |
  { 'RolesNotSet' : null } |
  { 'CallerNotRole' : Role } |
  { 'CallerNotWatcherOrController' : null } |
  {
    /**
     * Neither service principal, and not a controller either: the claim's door, which ops
     * may open by hand.
     */
    'CallerNotQuoterWatcherOrController' : null
  } |
  { 'CallerNotQuoterOrWatcher' : null } |
  { 'Halted' : null } |
  { 'RoleNotSet' : Role };
export interface IcpAccount {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface IcpRoute { 'via' : IcpRouteVia, 'ledger' : Principal }
/**
 * The token/ckUSDC pool, or the token/ICP pool.
 */
export type IcpRouteVia = { 'Icp' : Principal } |
  { 'Direct' : Principal };
/**
 * `icp_routes`' answer.
 */
export interface IcpRoutesView {
  'icp_ckusdc_pool' : [] | [Principal],
  'routes' : Array<IcpRoute>,
}
/**
 * An ICP user's swap to an EVM token through the pool.
 */
export interface IcpSwapTerms {
  /**
   * ckUSDC or a listed ICP token.
   */
  'token_in' : Principal,
  'plan' : PayoutPlan,
  /**
   * At most 500: half of it is the sale's on ICP, the rest the plan's own swap.
   */
  'slippage_bps' : number,
  'from_subaccount' : [] | [Uint8Array | number[]],
  /**
   * Default: the caller's account.
   */
  'refund_to' : [] | [IcpAccount],
  /**
   * 5 minutes to 1 hour ahead: after it nothing is signed and the swap is undone.
   */
  'deadline_ns' : bigint,
  /**
   * Pulled with `icrc2_transfer_from` from the caller's account.
   */
  'amount_in' : bigint,
}
export interface IcpTokenEntry {
  'ledger' : Principal,
  'icpswap_pool' : Principal,
}
/**
 * What an install starts from: the whole config and both service roles, so a canister is
 * never live on default knobs or without its quoter and watcher. Each is validated as
 * `set_config` and `set_roles` validate it, and anything invalid fails the install.
 */
export interface InitArg {
  'watcher' : Principal,
  'config' : Config,
  'quoter' : Principal,
}
export type MoveDirection = { 'IcpToBase' : null } |
  { 'BaseToIcp' : null };
/**
 * The controller's answer to a stuck move (`resolve_move`): send it on from where it
 * stands, or write it off with why.
 */
export type MoveResolution = { 'Lost' : string } |
  { 'Retry' : null };
/**
 * Where a move stands. `Signed` is the id of its transaction in `signed_txs`.
 */
export type MoveStatus = { 'Routed' : null } |
  { 'Arrived' : null } |
  { 'Burned' : null } |
  { 'Stuck' : string } |
  { 'Open' : null } |
  { 'Landed' : null } |
  { 'Signed' : bigint };
/**
 * One move.
 */
export interface MoveView {
  'id' : bigint,
  /**
   * The move's ref (32 bytes): the `Order.ref` and envelope ref of any route for it.
   */
  'ref' : Uint8Array | number[],
  'status' : MoveStatus,
  'direction' : MoveDirection,
  'arrived' : [] | [bigint],
  /**
   * Micro USDC, the canister's own CCTP route estimate.
   */
  'own_route_cost' : bigint,
  'opened_at_ns' : bigint,
  /**
   * Proposals are accepted until then; none for an urgent move.
   */
  'window_ends_ns' : [] | [bigint],
  'urgent' : boolean,
  /**
   * Micro USDC.
   */
  'amount' : bigint,
}
/**
 * What a controller does with an orphan.
 */
export type OrphanAction = {
    /**
     * Booked to the Base books' unattributed line.
     */
    'Book' : null
  } |
  {
    /**
     * Sent back on Base, less the least network fee.
     */
    'Refund' : { 'to' : string }
  };
/**
 * An orphan held for a controller: its credit key (48 bytes: chain, transaction, log
 * index), what arrived, the block, its payer where the chain showed it, and why no deposit
 * took it.
 */
export interface OrphanView {
  'key' : Uint8Array | number[],
  'why' : string,
  'block' : bigint,
  'payer' : [] | [string],
  'amount' : bigint,
}
/**
 * `pay_payout`'s answer: the signed transaction's id in `signed_txs`.
 */
export interface PayPayoutOk { 'tx_id' : bigint }
export type PayoutKind = { 'IcpSwap' : null } |
  { 'Withdrawal' : null };
/**
 * The payout plan (2026-10-23): the quoter's ready-made Swapic order for the expected
 * payout (its `amountIn`), as `abi.encode(order)`, and the gas it is signed with, as
 * `pay_payout` takes them. Its one delivery names the chain, the recipient, the token and
 * the least out.
 */
export interface PayoutPlan {
  'order' : Uint8Array | number[],
  'gas_limit' : bigint,
}
/**
 * A controller's answer to a payout stopped for a human (`resolve_payout`): its money back to
 * its user (an ICP swap's refund, a withdrawal's shares minted back), or its signed order
 * found paid.
 */
export type PayoutResolution = { 'Refund' : null } |
  { 'MarkPaid' : null };
export interface PayoutSettings {
  /**
   * Micro USDC, the least a payout's network fee may be.
   */
  'min_network_fee' : bigint,
  /**
   * Micro USDC, the least network fee a payout over CCTP carries (the user's line for the
   * canister's own finish on the destination). None: no CCTP payout is signed.
   */
  'cctp_min_network_fee' : [] | [bigint],
  /**
   * How long a waiting payout waits for a valid order before it is retried, then undone
   * at its deadline.
   */
  'order_wait_s' : bigint,
  /**
   * The most gas a payout order may be signed with on Base.
   */
  'max_payout_gas' : bigint,
  /**
   * The least a stake's or a withdrawal's rebalancing share may be, in bps of its amount.
   */
  'rebalance_share_floor_bps' : number,
}
export type PayoutStatus = { 'Queued' : null } |
  {
    /**
     * Its refund is on its way, with why: a revert, an Eco intent never filled, or its
     * deadline (nothing is signed for it again).
     */
    'Refunding' : string
  } |
  { 'Failed' : string } |
  {
    /**
     * Its order ran on Base and published an Eco intent: paid once the intent's fill is read.
     */
    'Delivering' : null
  } |
  { 'Paid' : null } |
  { 'Pulling' : null } |
  { 'Swapping' : null } |
  { 'Undone' : string } |
  { 'Waiting' : null } |
  { 'Signed' : bigint };
/**
 * Where and how a payout pays the user.
 */
export interface PayoutTerms {
  /**
   * A chain the canister signs on, Base included.
   */
  'dst_chain' : bigint,
  /**
   * In `token_out`'s units.
   */
  'min_out' : bigint,
  /**
   * An EVM address.
   */
  'recipient' : string,
  /**
   * After this, nothing is signed and the payout is undone.
   */
  'deadline_ns' : bigint,
  /**
   * An EVM token address, or `0xEeee...EEeE` for the native coin.
   */
  'token_out' : string,
}
export interface PayoutView {
  'id' : bigint,
  'status' : PayoutStatus,
  'terms' : PayoutTerms,
  'kind' : PayoutKind,
  /**
   * The plan's amount (`amountIn`), for a swap opened with a plan.
   */
  'planned' : [] | [bigint],
  'order_id' : [] | [Uint8Array | number[]],
  'tx_hash' : [] | [Uint8Array | number[]],
  /**
   * The exact USDC the payout order must spend on Base.
   */
  'amount' : [] | [bigint],
  /**
   * The ckUSDC the swap made on ICP, once known.
   */
  'received' : [] | [bigint],
}
export interface PayoutWaiting {
  'id' : bigint,
  'terms' : PayoutTerms,
  'kind' : PayoutKind,
  'amount' : bigint,
  /**
   * Micro USDC, the payout's own network fee (P11e): the watcher chooses CCTP only when it
   * covers the canister's CCTP costs.
   */
  'network_fee' : [] | [bigint],
}
/**
 * Why a pocket cannot make a move.
 */
export type PocketError = { 'Overflow' : null } |
  { 'InsufficientReserved' : { 'requested' : bigint, 'reserved' : bigint } } |
  { 'InsufficientAvailable' : { 'requested' : bigint, 'available' : bigint } };
export interface PocketView {
  'free' : bigint,
  'reserved' : bigint,
  'in_flight' : bigint,
}
/**
 * Who owns shares.
 */
export type PoolAccount = {
    /**
     * An EIP-55 or lowercase 0x address.
     */
    'Evm' : string
  } |
  { 'Icp' : IcpAccount };
export interface PoolAccountView { 'value_usdc' : bigint, 'shares' : bigint }
export interface PoolArrival {
  /**
   * The terms of the deposit the transfer pays, whose ref its proof must carry.
   */
  'terms' : PoolTerms,
  'base_tx' : Uint8Array | number[],
  'src_chain' : bigint,
  'src_tx' : Uint8Array | number[],
}
export type PoolArrivalOutcome = {
    /**
     * The payout follows on the canister's timer.
     */
    'Credited' : { 'ref' : Uint8Array | number[], 'amount' : bigint }
  } |
  { 'Unattributed' : { 'why' : string, 'amount' : bigint } };
export type PoolDepositKind = { 'Stake' : { 'owner' : PoolAccount } } |
  {
    /**
     * `token_out`: a ledger in `pool_settings.icp_tokens`, ckUSDC itself included.
     */
    'Swap' : {
      'min_out' : bigint,
      'recipient' : IcpAccount,
      'token_out' : Principal,
    }
  };
export type PoolDepositStatus = { 'Arrived' : null } |
  { 'Paying' : null } |
  {
    /**
     * A controller sent what arrived back to its payer on Base (`resolve_deposit`): an
     * orphan under its transfer's key (`pool_orphans`) until its refund is signed.
     */
    'Refunded' : null
  } |
  { 'Paid' : null } |
  { 'Unattributed' : null } |
  { 'PayoutFailed' : string } |
  { 'Registered' : null } |
  { 'Expired' : null };
export interface PoolDepositView {
  'ref' : Uint8Array | number[],
  'status' : PoolDepositStatus,
  'shares_minted' : [] | [bigint],
  'base_tx' : [] | [Uint8Array | number[]],
  'premium' : bigint,
  'arrived' : [] | [bigint],
  'kind' : PoolDepositKind,
  'paid' : [] | [bigint],
  'rail' : PoolRail,
  'min_usdc' : bigint,
  'src_chain' : bigint,
  'payout_block' : [] | [bigint],
  'rebalance_share' : bigint,
}
export type PoolError = { 'NotDeep' : { 'have' : bigint, 'needed' : bigint } } |
  { 'Sanctioned' : string } |
  { 'TokenNotListed' : Principal } |
  {
    /**
     * The role guard, or an argument the canister does not take.
     */
    'NotAllowed' : string
  } |
  {
    /**
     * `require_pool_open`'s reason.
     */
    'Closed' : string
  } |
  { 'AlreadyCredited' : null } |
  { 'AboveTvlCap' : { 'cap' : bigint, 'would_be' : bigint } } |
  {
    /**
     * No longer answered (2026-10-23): the canister enforces no per swap cap; kept, the wire
     * being append-only.
     */
    'AboveSwapCap' : { 'cap' : bigint }
  } |
  {
    /**
     * The ref is registered already.
     */
    'Known' : null
  } |
  {
    /**
     * The ref does not match section 2.
     */
    'BadRef' : null
  } |
  {
    /**
     * No registration under this ref.
     */
    'Unknown' : null
  } |
  {
    /**
     * An ICRC or ICPSwap call failed.
     */
    'Ledger' : string
  } |
  { 'BadSettings' : string } |
  {
    /**
     * An outcall failed: ask again.
     */
    'Unavailable' : string
  } |
  {
    /**
     * The proof failed: why.
     */
    'BadArrival' : string
  } |
  { 'Halted' : null } |
  { 'PremiumTooLow' : { 'least' : bigint } } |
  { 'Expired' : null } |
  { 'ShortShares' : { 'have' : bigint, 'need' : bigint } };
export type PoolRail = { 'Eco' : null } |
  { 'Cctp' : null } |
  { 'SameChain' : null };
export interface PoolSettings {
  /**
   * Micro USDC, launch 1_000_000_000 ($1,000): the quoter's per swap cap, which the
   * canister stores and shows but enforces nowhere (2026-10-23).
   */
  'per_swap_cap' : bigint,
  'ckusdc_ledger' : Principal,
  /**
   * Launch 10.
   */
  'premium_bps' : number,
  /**
   * Micro USDC, launch 10_000_000_000 ($10,000).
   */
  'tvl_cap' : bigint,
  'icp_tokens' : Array<IcpTokenEntry>,
  /**
   * The pool chain's blocks a large deposit waits. Absent: 6.
   */
  'large_deposit_confirmations' : [] | [bigint],
  /**
   * Off until a controller opens the pool for swaps.
   */
  'pool_open_for_swaps' : boolean,
  /**
   * The canister's own Base read, its backup of the reports (default 300). (P11d drops
   * the registrations' knobs: `deposit_grace_s`, `max_open_per_payer`, `max_held_bps`.)
   */
  'arrival_backup_s' : bigint,
  /**
   * Micro USDC: a deposit whose one transfer is above this waits
   * `large_deposit_confirmations` blocks before it is credited. Absent: 1_000_000_000
   * ($1,000).
   */
  'large_deposit_usdc' : [] | [bigint],
}
export interface PoolStateView {
  'icp' : PocketView,
  /**
   * The quoter's per swap cap, as the canister stores it: enforced nowhere by the canister.
   */
  'per_swap_cap' : bigint,
  'base' : PocketView,
  'open' : boolean,
  'total_shares' : bigint,
  'premium_bps' : number,
  'tvl_cap' : bigint,
  'total_assets' : bigint,
  'closed_reason' : [] | [string],
}
/**
 * A pool deposit's terms (P11d, 2026-10-21: no registration): the preimage of the ref its
 * order carries (section 2), handed to the canister with the arrival. Every fee is the
 * user's own line: a swap's premium (pure pool income) and its ICP path's ledger fees
 * (`icp_fees`, at least the path's own ckUSDC fees); a stake's rebalancing share.
 */
export interface PoolTerms {
  /**
   * Swap: micro USDC; Stake: 0.
   */
  'premium' : bigint,
  'kind' : PoolDepositKind,
  /**
   * Swap: micro USDC; Stake: 0.
   */
  'icp_fees' : bigint,
  /**
   * 32 bytes.
   */
  'salt' : Uint8Array | number[],
  /**
   * Stake: micro USDC; Swap: 0.
   */
  'rebalance_share' : bigint,
}
/**
 * Why `push_chain_data` stored nothing.
 */
export type PushChainDataError = { 'Guard' : GuardError } |
  { 'InvalidData' : ChainDataError };
/**
 * Why a quote was refused, naming the field wherever one is at fault.
 */
export type QuoteError = { 'NotUtf8' : { 'field' : string } } |
  { 'TextTooLong' : { 'len' : bigint, 'field' : string } } |
  { 'EmptyRefundAddress' : null } |
  { 'UnknownRail' : string } |
  { 'NotABool' : { 'field' : string, 'value' : number } } |
  { 'NotAGasMode' : number } |
  { 'UnsupportedVersion' : number } |
  { 'EmptyText' : { 'field' : string } } |
  { 'TrailingBytes' : { 'len' : bigint, 'consumed' : bigint } } |
  {
    'Truncated' : {
      'at' : bigint,
      'len' : bigint,
      'field' : string,
      'wanted' : bigint,
    }
  } |
  { 'AmountTooLarge' : { 'field' : string } };
export interface RebalanceSettings {
  'max_move' : bigint,
  'standard_when_idle' : boolean,
  'daily_cap' : bigint,
  'proposal_window_s' : bigint,
  'min_move' : bigint,
  'band_bps' : number,
  'target_icp_bps' : number,
  'max_proposal_fee_bps' : number,
}
/**
 * The arrival swap a CCTP Swap completes with (ABI v3 `Recipe`): `target` is called with
 * `data` paying the Runner, rescaled to what arrived by `scaler` when one is named.
 * Addresses are EVM addresses.
 */
export interface Recipe {
  'scaler' : [] | [string],
  'data' : Uint8Array | number[],
  'target' : string,
}
/**
 * A relay's status.
 */
export type RelayStatus = {
    'Failed' : {
      'chain_id' : bigint,
      'block' : bigint,
      'tx_hash' : Uint8Array | number[],
    }
  } |
  {
    'Confirmed' : {
      'chain_id' : bigint,
      'block' : bigint,
      'tx_hash' : Uint8Array | number[],
    }
  } |
  {
    /**
     * Signed and on its way; `tx_hash` is the first broadcast's.
     */
    'Signed' : { 'chain_id' : bigint, 'tx_hash' : Uint8Array | number[] }
  };
/**
 * Why the log does not fold. The replay stopped at `index` and applied nothing from there.
 */
export type ReplayError = {
    'OutOfSequence' : { 'found' : bigint, 'expected' : bigint }
  } |
  { 'LogFull' : { 'index' : bigint } } |
  { 'Refused' : { 'error' : TransitionError, 'index' : bigint } } |
  {
    'Unlinked' : {
      'head' : Uint8Array | number[],
      'index' : bigint,
      'parent' : Uint8Array | number[],
    }
  };
export type Result = { 'Ok' : AuditProgress } |
  { 'Err' : GuardError };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_10 = { 'Ok' : null } |
  { 'Err' : SetConfigError };
export type Result_11 = { 'Ok' : null } |
  { 'Err' : FlowCallError };
export type Result_12 = { 'Ok' : null } |
  { 'Err' : GuardError };
export type Result_13 = { 'Ok' : null } |
  { 'Err' : SetRolesError };
export type Result_14 = { 'Ok' : bigint } |
  { 'Err' : SetSanctionedError };
export type Result_15 = { 'Ok' : StakeIcpOk } |
  { 'Err' : PoolError };
export type Result_16 = { 'Ok' : SwapFromIcpOk } |
  { 'Err' : PoolError };
export type Result_17 = { 'Ok' : WithdrawEvmOk } |
  { 'Err' : PoolError };
export type Result_18 = { 'Ok' : WithdrawIcpOk } |
  { 'Err' : PoolError };
export type Result_2 = { 'Ok' : string } |
  { 'Err' : SignError };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Config } |
  { 'Err' : GuardError };
export type Result_5 = { 'Ok' : PoolArrivalOutcome } |
  { 'Err' : PoolError };
export type Result_6 = { 'Ok' : PayPayoutOk } |
  { 'Err' : PoolError };
export type Result_7 = { 'Ok' : null } |
  { 'Err' : PoolError };
export type Result_8 = { 'Ok' : null } |
  { 'Err' : PushChainDataError };
export type Result_9 = { 'Ok' : PayPayoutOk } |
  { 'Err' : string };
/**
 * A service role the canister hands out.
 */
export type Role = { 'Quoter' : null } |
  { 'Watcher' : null };
/**
 * Why `set_config` wrote nothing.
 */
export type SetConfigError = { 'InvalidConfig' : ConfigError } |
  { 'Guard' : GuardError } |
  { 'Append' : AppendError };
/**
 * Why `set_roles` wrote nothing.
 */
export type SetRolesError = { 'Guard' : GuardError } |
  { 'AnonymousRole' : Role } |
  { 'Append' : AppendError };
/**
 * Why `set_sanctioned` changed nothing.
 */
export type SetSanctionedError = {
    /**
     * The text at `index` of `list` (`"add"` or `"remove"`) is above the 256-byte cap.
     */
    'TextTooLong' : { 'len' : bigint, 'list' : string, 'index' : bigint }
  } |
  { 'Guard' : GuardError } |
  {
    /**
     * The set would grow past its cap; nothing of the call landed.
     */
    'SetFull' : { 'capacity' : bigint }
  };
/**
 * Why a call that needs the canister's threshold key answered nothing.
 */
export type SignError = { 'Guard' : GuardError } |
  { 'Ecdsa' : EcdsaError };
/**
 * A transaction the canister signed, for the watcher to broadcast. `id` orders them and
 * is the cursor `signed_txs` pages by.
 */
export interface SignedTx {
  'id' : bigint,
  'raw' : Uint8Array | number[],
  'hash' : Uint8Array | number[],
  'chain' : ChainRef,
  'signed_at_ns' : bigint,
}
export interface StakeIcpArgs {
  'owner' : PoolAccount,
  'from_subaccount' : [] | [Uint8Array | number[]],
  'amount' : bigint,
}
export interface StakeIcpOk { 'shares' : bigint }
/**
 * A controller's answer to an ICP stake whose pull's answer was lost past the ledger's
 * deduplication window (`resolve_stake`): the pull landed in ledger block `block`, or it
 * never landed.
 */
export type StakeResolution = { 'NotPulled' : null } |
  { 'Pulled' : { 'block' : bigint } };
/**
 * `swap_from_icp`'s answer: the payout's id, and where it stands as the call returns
 * (`Signed` when its plan fitted; `Waiting` when it waits for an order).
 */
export interface SwapFromIcpOk { 'id' : bigint, 'status' : PayoutStatus }
/**
 * Where a swap is in its lifecycle. Plan 3 and the indexer read a swap's progress from it.
 */
export type SwapStatus = { 'PaidInStable' : null } |
  { 'Refunding' : null } |
  { 'WaitingForUser' : null } |
  { 'FundsReceived' : null } |
  { 'Delivering' : null } |
  { 'Refunded' : null } |
  { 'Done' : null } |
  { 'Executing' : null } |
  { 'Frozen' : null };
/**
 * Why an event cannot move the state it was offered to.
 */
export type TransitionError = {
    'NoUnsignedNonce' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
    }
  } |
  {
    /**
     * The line says the funds arrived on `logged`, and the quote it carries is for
     * `quoted`.
     */
    'FundsChainNotTheQuotes' : { 'logged' : bigint, 'quoted' : bigint }
  } |
  { 'CannotAskWhileRefunding' : null } |
  {
    'NonceNeverAllocated' : {
      'next' : bigint,
      'chain_id' : bigint,
      'nonce' : bigint,
    }
  } |
  { 'WaitingForUser' : null } |
  { 'NotRefunding' : SwapStatus } |
  { 'Pocket' : PocketError } |
  {
    /**
     * A flow step refused, with the domain's reason.
     */
    'Flow' : string
  } |
  { 'Pool' : string } |
  { 'SwapExists' : Uint8Array | number[] } |
  { 'AttemptStillOpen' : number } |
  { 'Books' : string } |
  { 'UnknownSwap' : Uint8Array | number[] } |
  { 'NonceStillUnsigned' : Uint8Array | number[] } |
  { 'NotExecuting' : SwapStatus } |
  { 'NoOpenAttempt' : Uint8Array | number[] } |
  {
    'QuoteHashMismatch' : {
      'computed' : Uint8Array | number[],
      'declared' : Uint8Array | number[],
    }
  } |
  { 'UnparseableQuote' : QuoteError } |
  {
    'NonceOutOfSequence' : {
      'expected' : bigint,
      'chain_id' : bigint,
      'nonce' : bigint,
    }
  } |
  { 'NonceExhausted' : { 'chain_id' : bigint } } |
  { 'SwapClosed' : SwapStatus } |
  { 'FeesOverflow' : null } |
  {
    'AttemptOutOfSequence' : { 'attempt' : number, 'expected' : [] | [number] }
  } |
  { 'NonceNotUnsigned' : { 'chain_id' : bigint, 'nonce' : bigint } } |
  { 'AmountOutOfRange' : bigint } |
  { 'AttemptNotOpen' : number } |
  { 'CannotStartRefund' : SwapStatus } |
  { 'NotInFlight' : SwapStatus } |
  { 'NotWaitingForUser' : SwapStatus } |
  {
    /**
     * The swap already holds its platform fee: one fee line per swap.
     */
    'FeeAlreadyAccrued' : Uint8Array | number[]
  } |
  {
    /**
     * The line says `logged` arrived, and the quote it carries is for `quoted`.
     */
    'FundsTokenNotTheQuotes' : { 'logged' : string, 'quoted' : string }
  } |
  {
    /**
     * The line says `logged` arrived, and the quote it carries is for `quoted`.
     */
    'FundsAmountNotTheQuotes' : { 'logged' : bigint, 'quoted' : bigint }
  } |
  { 'AlreadyPaid' : null } |
  { 'UnknownPocket' : bigint } |
  {
    'NonceNotHeldForPull' : {
      'quote_hash' : Uint8Array | number[],
      'chain_id' : bigint,
      'nonce' : bigint,
    }
  };
/**
 * Why an outbound transaction exists. All but the last name the swap they belong to.
 */
export type TxPurpose = { 'Continue' : Uint8Array | number[] } |
  {
    /**
     * A pool payout from the canister's Base pocket, by its payout id.
     */
    'PoolPayout' : bigint
  } |
  { 'Payout' : Uint8Array | number[] } |
  { 'Burn' : Uint8Array | number[] } |
  { 'Mint' : Uint8Array | number[] } |
  { 'Refund' : Uint8Array | number[] } |
  {
    /**
     * Eco's `cancelAndProve` of an unfilled intent, by the order id that published it.
     */
    'EcoRescue' : Uint8Array | number[]
  } |
  { 'GaslessPull' : Uint8Array | number[] } |
  {
    /**
     * The canister's standing USDC allowance to Swapic.
     */
    'PoolApprove' : null
  } |
  { 'Relay' : Uint8Array | number[] } |
  {
    /**
     * An orphan sent back, by the hash of its credit key.
     */
    'PoolTransfer' : Uint8Array | number[]
  } |
  {
    /**
     * A rebalance move's own transaction, by the move's id.
     */
    'PoolMove' : bigint
  } |
  { 'Finish' : Uint8Array | number[] } |
  { 'Cancel' : bigint } |
  { 'Reclaim' : Uint8Array | number[] };
/**
 * `withdraw_evm`'s answer: the payout's id and the shares burned.
 */
export interface WithdrawEvmOk { 'id' : bigint, 'burned' : bigint }
export interface WithdrawIcpArgs {
  'to' : IcpAccount,
  'max_shares' : bigint,
  /**
   * The caller's subaccount owning the shares.
   */
  'from' : [] | [Uint8Array | number[]],
  'min_out' : bigint,
  'usdc' : bigint,
  'token_out' : Principal,
}
export interface WithdrawIcpOk { 'paid' : bigint, 'burned' : bigint }
export interface _SERVICE {
  /**
   * Controller-only. One step of the deep check: folds up to `max_events` more of the log
   * onto the fold the step before saved, from genesis when there is none, and once the fold
   * reaches the head compares it with the live state. An update, not a query, because a
   * divergence it finds halts the canister, and because the fold so far is saved in stable
   * memory between steps, so an audit spans as many calls as the log needs and survives an
   * upgrade in the middle.
   * 
   * Each step answers how much is folded and how much is left; keep calling until
   * `finished`. A refusal, a broken link, or a finished fold that differs from the live
   * state halts the canister, and every verdict starts the next audit over from genesis.
   * 
   * A step costs the entries it folds plus the fold so far, which is read and written whole,
   * so on a large fold the fold's own size is the floor and `max_events` is the rest. A step
   * too large for one message fails that call alone and leaves the saved fold where it was.
   */
  'audit_replay_step' : ActorMethod<[bigint], Result>,
  /**
   * Controller-only. Moves a surplus the last balance check found on `chain_id`, once
   * someone has looked at it, into the `unattributed` line.
   */
  'book_surplus' : ActorMethod<[bigint, bigint], Result_1>,
  /**
   * The book lines of every chain, in micro-USDC, with the last balance check.
   */
  'books' : ActorMethod<[], Array<[bigint, BookLines]>>,
  /**
   * Controller-only. Derives the canister's EVM address from its threshold key and caches
   * it, or answers the cached one. Deploy needs this before anything else: the Swapic
   * contracts are configured with this address and it has to be funded for gas, and neither
   * can wait for the first transaction to derive it.
   */
  'derive_evm_address' : ActorMethod<[], Result_2>,
  'event_count' : ActorMethod<[], bigint>,
  /**
   * `len` is capped server-side; ask for the count first and page through.
   */
  'events_page' : ActorMethod<[bigint, bigint], Array<Event>>,
  /**
   * The EVM address this canister signs from, in its EIP-55 checksum, or nothing before it
   * has been derived. World-readable: it is the canister the Swapic contracts on every chain
   * name, and ops fund it before the first transaction.
   * 
   * Derived once from the canister's threshold key and then read from stable memory, so it
   * is fixed for the life of the canister. `derive_evm_address` is the door that derives it.
   */
  'evm_address' : ActorMethod<[], [] | [string]>,
  /**
   * Watcher-only, refused while halted. Finishes a CCTP arrival on `chain_id`, the
   * destination. `message` and `attestation` are Circle's, the message 696 bytes with the
   * v3 envelope as its hook data; `src_tx_hash` is the source transaction that burned it,
   * which the watcher has proven paid the canister's fee (I-3.4); `gas_limit` is the limit
   * the quoter charged for. From the envelope and the clock: a Deliver is received on the
   * message transmitter; a Swap (with `recipe`, required) or a CkDeposit (with none) is
   * completed on the CctpReceiver before its deadline, and released after it. Signed with
   * exactly `gas_limit` and refused above the chain's maximum for the action, but a release,
   * which is signed at that maximum; held to the gas rule; once per arrival (the burn, by
   * its source domain and Circle's nonce, so a re-attested message is the same arrival)
   * and action, and one arrival per source transaction.
   * Answers the signed transaction's id in `signed_txs`.
   * 
   * `reading`, when given, is `chain_id`'s reading the watcher priced the finish on. It is
   * stored right after the role and the halt, as `push_chain_data` stores one, so no
   * separate push has to land before this call; an invalid one refuses the call with
   * `push_chain_data`'s error text. A reading whose block is not above the stored one's is
   * kept out and the stored one is used, as it is with none.
   */
  'finish_cctp' : ActorMethod<
    [
      bigint,
      Uint8Array | number[],
      Uint8Array | number[],
      [] | [Recipe],
      Uint8Array | number[],
      bigint,
      [] | [ChainData],
    ],
    Result_3
  >,
  /**
   * The cached reading for a chain, with the instant the canister stamped it, or nothing for
   * a chain the watcher has never pushed. World-readable: a block height and a gas price are
   * public facts about a public chain, and the stamp is how ops see the watcher stop
   * pushing.
   * 
   * Answers the entry however old it is. Freshness is a decision, and the canister makes it
   * against `chain_data_max_age` at the moment it decides.
   */
  'get_chain_data' : ActorMethod<[bigint], [] | [ChainDataEntry]>,
  /**
   * Public, so it answers with the redacted view; `get_config_full` is the ops door onto
   * the real thing.
   */
  'get_config' : ActorMethod<[], Config>,
  /**
   * The unredacted config, for ops. Controller-only, because `rpc_urls` holds api keys.
   */
  'get_config_full' : ActorMethod<[], Result_4>,
  /**
   * A flow, any kind, as the fold holds it.
   */
  'get_flow' : ActorMethod<[Uint8Array | number[]], [] | [FlowView]>,
  /**
   * The flows' settings.
   */
  'get_flow_settings' : ActorMethod<[], FlowSettings>,
  /**
   * True once the canister has stopped on a divergence. Three things set it today: the audit
   * timer finding the fold out of step with the log, that same timer finding a bad link in
   * the chunk of the chain it verified, and a controller calling `set_halted`.
   * 
   * The deep comparison of the fold against a replay of the log is not on that timer: it is
   * the controller-only `audit_replay_step`, run as many times as the log needs, and it
   * halts the canister on what it finds. While it is set nothing is signed, sent or paid.
   * 
   * Nothing clears it but a controller, once the divergence is understood.
   */
  'halted' : ActorMethod<[], boolean>,
  /**
   * The ICP routes every ICP path of the pool reads: the ICP/ckUSDC pool, and each listed
   * token's route. Empty while none are set.
   */
  'icp_routes' : ActorMethod<[], IcpRoutesView>,
  /**
   * Anyone (the watcher), refused while halted: an ICP to Base move's USDC reached the
   * canister's Base address in `base_tx` (and, for an Eco route, the order's `src_tx` on
   * `src_chain`; an empty `src_tx` names none). The canister reads the receipts itself, proves
   * the transfer carries the move's own ref (its CCTP envelope, or the Eco source's
   * `OrderStarted`), and credits the move once. A caller other than the watcher is held to 10
   * reports a minute in total and 3 an hour per `base_tx` (P11e), refused `Unavailable` before
   * any outcall.
   */
  'note_move_arrival' : ActorMethod<
    [bigint, Uint8Array | number[], bigint, Uint8Array | number[]],
    Result_5
  >,
  /**
   * Any caller (the watcher, or the user's app as a backup), refused while halted (P11d,
   * 2026-10-21: no registration). A USDC transfer to the canister's Base address in
   * `base_tx` (and, for an Eco arrival, the order's `src_tx` on `src_chain`; an empty
   * `src_tx` names none) pays the deposit whose `terms` are handed over. The canister reads
   * the receipt itself (one batched outcall, and one more on the source chain for Eco) at
   * the crediting depth, proves every transfer to it against its rail, recomputes the ref
   * from the terms and credits the transfer whose proof carries it, at most once:
   * `Credited` (the payout follows on the canister's timer), or `Unattributed` with why,
   * held for a controller. `BadArrival` when no transfer carries the terms' ref. The
   * canister trusts only the chain and the fingerprint. A caller other than the watcher is
   * held to 10 reports a minute in total and 3 an hour per `base_tx` (P11e), refused
   * `Unavailable` before any outcall.
   */
  'note_pool_arrival' : ActorMethod<[PoolArrival], Result_5>,
  /**
   * Watcher-only, refused while halted and while the pool is closed: the order the quoter
   * built for waiting payout `id` at its exact amount (`abi.encode` of an Order), and the gas
   * limit to sign it with. The canister checks the untrusted order against the payout's own
   * terms (payer the canister, Base USDC in, exactly the payout's amount, no fee step, no CCTP
   * burn, one delivery paying the recipient at least their minimum of their token on their
   * chain, an Eco intent's reward refunding the canister, a deadline at least 60 s away and
   * within the payout's, no sanctioned party, the gas within `max_payout_gas`) and signs
   * `Swapic.run(order)` from its own Base pocket. A payout signed already answers its
   * transaction's id; a retry after a revert signs only the order it pinned.
   */
  'pay_payout' : ActorMethod<[bigint, Uint8Array | number[], bigint], Result_6>,
  /**
   * A payout from the Base pocket by its id, if one was opened under it.
   */
  'payout' : ActorMethod<[bigint], [] | [PayoutView]>,
  /**
   * The Base payouts' knobs; the launch defaults while none are set.
   */
  'payout_settings' : ActorMethod<[], PayoutSettings>,
  /**
   * The payouts waiting for an order, the longest waiting first, at most 50: what the watcher
   * asks the quoter for, each at its exact amount.
   */
  'payouts_waiting' : ActorMethod<[], Array<PayoutWaiting>>,
  /**
   * An account's shares and what they are worth now. An account that is no account (an
   * address that is none, a subaccount that is not 32 bytes) traps with the reason.
   */
  'pool_account' : ActorMethod<[PoolAccount], PoolAccountView>,
  /**
   * Controller-only, refused while halted, once per deploy: the canister's standing USDC
   * allowance to the ck minter's deposit helper on Ethereum (flow settings' `ck_helper`), which
   * a move to ICP by Eco deposits through. An allowance in place answers `Known`.
   */
  'pool_approve_ck_helper' : ActorMethod<[], Result_6>,
  /**
   * Controller-only, refused while halted, once per deploy and chain (Base, and Ethereum for
   * the moves to Base, P11c): reads the canister's USDC allowance to Swapic on `chain_id` and,
   * below 2^255, signs `USDC.approve(Swapic, 2^256 - 1)`, so every pool payout and move is one
   * signature of `Swapic.run`. Safe because `run` pulls only from `payer == msg.sender`. An
   * allowance already in place answers `Known`; an approval on its way answers `Unavailable`.
   */
  'pool_approve_swapic' : ActorMethod<[bigint], Result_6>,
  /**
   * A deposit by its ref, if one is registered under it.
   */
  'pool_deposit' : ActorMethod<[Uint8Array | number[]], [] | [PoolDepositView]>,
  /**
   * The orphans held for a controller: USDC at the canister's Base address no deposit could
   * take, not refunded or booked yet (a deposit's transfer found without its terms only once
   * its 24 hours of waiting for them are over).
   */
  'pool_orphans' : ActorMethod<[], Array<OrphanView>>,
  /**
   * The pool's knobs; the launch defaults while none are set.
   */
  'pool_settings' : ActorMethod<[], PoolSettings>,
  /**
   * Whether the pool is open and why not, both pockets' lines, the stakers' assets and the
   * shares outstanding, and the caps.
   */
  'pool_state' : ActorMethod<[], PoolStateView>,
  /**
   * Watcher-only, refused while halted and while the pool is closed: an order (`abi.encode` of
   * an Order) for move `id`, signed with `gas_limit` if its route is taken. Checked as
   * untrusted input, every rule of the spec's section 3.4; taken only within the move's window
   * and when cheaper than any taken before: the cheapest at the window's end wins.
   */
  'propose_rebalance' : ActorMethod<
    [bigint, Uint8Array | number[], bigint],
    Result_7
  >,
  /**
   * Watcher-only. Ambient chain data: the head and the gas prices the watcher saw, which the
   * canister would otherwise spend an outcall on before every decision. It moves no money,
   * so the halt switch does not gate it: a halted canister still wants a current view of the
   * chains while ops investigate.
   * 
   * The record carries no instant. The canister stamps what it stores with its own clock,
   * because the age of a reading is what every decision on it depends on, and a caller that
   * could date its data forward could keep stale gas prices alive indefinitely.
   */
  'push_chain_data' : ActorMethod<[bigint, ChainData], Result_8>,
  /**
   * The open and in-flight moves, in id order.
   */
  'rebalance_moves' : ActorMethod<[], Array<MoveView>>,
  /**
   * The rebalancing's knobs; the defaults while none are set.
   */
  'rebalance_settings' : ActorMethod<[], RebalanceSettings>,
  /**
   * The moves stopped for a controller, held where they are (in flight where they left).
   */
  'rebalance_stuck' : ActorMethod<[], Array<MoveView>>,
  /**
   * Watcher-only (the submit API runs as the watcher), refused while halted. Relays a
   * user's gasless order through Swapic on `chain_id` as `runFor(order, auth)`: `order` is
   * `abi.encode(Order)` of ABI v3 and `auth` is `abi.encode(GaslessAuth)`, each one dynamic
   * tuple with its leading offset word, as viem's `encodeAbiParameters` writes it. The
   * order id is recomputed from the order and the chain's Swapic (the 3009 door's nonce
   * must be it); the order must pay this canister exactly one fee step of at least the
   * chain's `min_network_fee` for its rail, plus on CCTP the destination's for the arrival;
   * it is signed with exactly `gas_limit` (the limit the quoter charged for), refused when
   * that is above the chain's maximum for the action, and held to the gas rule. Signed
   * once per order id: a second call answers the first one's id. Answers the signed
   * transaction's id in `signed_txs`; `relay_status(order_id)` follows it.
   * 
   * `reading`, when given, is `chain_id`'s reading the watcher priced the relay on. It is
   * stored right after the role and the halt, as `push_chain_data` stores one, so no
   * separate push has to land before this call; an invalid one refuses the call with
   * `push_chain_data`'s error text. A reading whose block is not above the stored one's is
   * kept out and the stored one is used, as it is with none.
   */
  'relay_gasless' : ActorMethod<
    [
      bigint,
      Uint8Array | number[],
      Uint8Array | number[],
      bigint,
      [] | [ChainData],
    ],
    Result_3
  >,
  /**
   * A gasless relay's status: signed, then confirmed or failed at depth.
   */
  'relay_status' : ActorMethod<[Uint8Array | number[]], [] | [RelayStatus]>,
  /**
   * Watcher-only, refused while halted: for the Eco intent the order `order_id` published (a
   * relayed order's, a pool payout's or a move's: one the canister signed for), once its fill
   * deadline passed with no fill, the canister reads the order's own transaction and the
   * intent's destination Portal itself and signs `cancelAndProve` there, paying the proof's
   * fee (the `eco_rescue` gas row bounds both); Eco refunds the reward's creator on the source
   * by itself. One rescue per order: a second call answers the first one's id. Every rescue
   * is logged.
   */
  'rescue_eco_intent' : ActorMethod<[Uint8Array | number[]], Result_9>,
  /**
   * Controller-only, refused while halted (Jeff, 2026-10-24): an EVM to ICP deposit held for a
   * human (`PayoutFailed`: a payout stopped after its tenth failure, a queued one that never
   * started, a stake whose mint kept failing), resolved once by its ref (its 32 bytes).
   * `Retry`: back to its payout with fresh attempts. A started one whose transfer cannot land
   * twice (never asked, or refused by the ledger for sure with no answer of it ever lost) is
   * asked afresh, whatever it pays, at any time; one whose transfer may have landed keeps its
   * own dedup pair, so a transfer that landed is answered `Duplicate` and recorded paid once:
   * only on the ckUSDC ledger it started with, and with an hour of the ledger's
   * deduplication (23 hours) left. `Refund`: only when the canister knows nothing of its
   * payout went out (never started, or no ICPSwap leg moved money and its transfer never
   * asked or refused by the ledger for sure with no answer of it ever lost), refused while
   * the pool is closed and for a sanctioned or zero payer;
   * what arrived is held as an orphan under its transfer's key and the canister signs
   * `USDC.transfer(payer, amount - min_network_fee)` on Base, the fee kept for its gas. A
   * signature that fails answers `Unavailable`, the orphan held for `resolve_orphan`.
   * `MarkPaid { block }`: its transfer landed in that block; the canister reads it on the
   * transfer's ledger, the read chosen by what the ledger is (the ICP ledger the routes name
   * by its own `query_blocks`; `icrc3_get_blocks` when it lists ICRC-3 among its standards;
   * else `get_transactions`; each on the ledger or its archive, a read not answering in its
   * own shape falling to the next), and books the deposit paid only on exactly the transfer
   * its payout asked (from the canister to the recipient, of what it sent, its memo and
   * `created_at_time`); a ledger not read now (none of its reads answering) answers
   * `Unavailable` naming it, to be asked again. A refusal names what to search the ledger
   * for.
   */
  'resolve_deposit' : ActorMethod<
    [Uint8Array | number[], DepositResolution],
    Result_7
  >,
  /**
   * Controller-only, refused while halted: a stuck move sent on from where it stands
   * (`Retry`: a reverted order signed again, the same one; a minter's call a controller found
   * never ran asked again; a wait read again), or written off with why (`Lost`).
   */
  'resolve_move' : ActorMethod<[bigint, MoveResolution], Result_7>,
  /**
   * Controller-only, refused while halted (Jeff, 2026-10-19: orphans are ALWAYS held for a
   * controller): resolves the orphan under `key` (its 48 bytes, as `pool_orphans` lists it)
   * once. `Refund { to }` signs `USDC.transfer(to, amount - min_network_fee)` on Base, the
   * fee kept for its gas; `Book` books it to the Base books' unattributed line.
   */
  'resolve_orphan' : ActorMethod<
    [Uint8Array | number[], OrphanAction],
    Result_7
  >,
  /**
   * Controller-only, refused while halted (Jeff, 2026-10-23): a payout stopped for a human
   * (`Failed`), resolved once. `Refund`: back on its undo, an ICP swap's refund asked next (all
   * its ckUSDC less one ledger fee, or its token), a withdrawal's shares minted back at once;
   * the controller checked no refund went out before. `MarkPaid`: its signed order ran after
   * all, and its paid line is booked.
   */
  'resolve_payout' : ActorMethod<[bigint, PayoutResolution], Result_7>,
  /**
   * Controller-only, refused while halted (Jeff, 2026-10-24): an ICP stake whose pull's answer
   * was lost, past the ledger's deduplication window (23 hours after it started; the canister
   * stops asking its pull again then), resolved once by its op id (its 32 bytes, as its
   * `StakeStarted` line names it). `Pulled { block }`: the controller saw the pull in that
   * ckUSDC ledger block; the canister reads the block (as `resolve_deposit`'s `MarkPaid`
   * does) and mints the stake's shares at the pool's price now only when it is the stake's
   * own pull (from its account to the canister's, by the canister, its amount, its op id as
   * the memo, its start as `created_at_time`), one block for one stake; a ledger not reached
   * now answers `Unavailable`, to be asked again. `NotPulled`: it never landed (on the
   * controller's word: no read proves a pull absent), and it is dropped, its room freed.
   */
  'resolve_stake' : ActorMethod<
    [Uint8Array | number[], StakeResolution],
    Result_7
  >,
  /**
   * Controller-only, and it takes the whole record, so editing one knob is a
   * read-modify-write: read with `get_config_full`, never with the redacted `get_config`,
   * or the write puts "***" into `rpc_urls` and is refused.
   */
  'set_config' : ActorMethod<[Config], Result_10>,
  /**
   * Controller-only. The routers, the ck canisters, the ICPSwap pools a quote may name,
   * and the windows the flows read.
   */
  'set_flow_settings' : ActorMethod<[FlowSettings], Result_11>,
  /**
   * Controller-only, both ways: `true` is an emergency stop, `false` is the human saying
   * the divergence has been investigated. The audit never clears it on its own.
   * 
   * Lifting the halt wakes the outbox: a halted canister's pass does not re-arm itself,
   * so this is what puts it back on the window when a queued transaction or an allocation
   * waiting for its cancel was held back by the halt.
   */
  'set_halted' : ActorMethod<[boolean], Result_12>,
  /**
   * Controller-only, refused while halted. Sets the ICP routes (interface section 3c): the
   * ICP/ckUSDC pool, and each listed token's route, directly through its ckUSDC pool or
   * through ICP. Reads the ICP ledger off the ICP/ckUSDC pool and every route ledger's fee.
   * No token has a size cap of its own: the pool's per swap cap applies.
   */
  'set_icp_routes' : ActorMethod<[[] | [Principal], Array<IcpRoute>], Result_7>,
  /**
   * Controller-only, refused while halted. Sets the Base payouts' knobs: the least network
   * fee, the rebalancing share's floor, how long a waiting payout waits for an order, the
   * most gas a payout order is signed with, and the least network fee of a CCTP payout.
   */
  'set_payout_settings' : ActorMethod<[PayoutSettings], Result_7>,
  /**
   * Controller-only. Pauses the pool (`true`), or reopens it (`false`), which also clears a
   * shortfall the last balance check latched, once someone has looked at it. Recorded in
   * the log on the pool chain's books; the pool's guard reads it.
   */
  'set_pool_paused' : ActorMethod<[boolean], Result_1>,
  /**
   * Controller-only, refused while halted. Sets the pool's knobs after reading the ckUSDC
   * ledger's fee and every listed token's (`icrc1_fee`), which the ICP fees' floor at an
   * arrival reads.
   */
  'set_pool_settings' : ActorMethod<[PoolSettings], Result_7>,
  /**
   * Controller-only, refused while halted: the rebalancing's knobs, held together.
   */
  'set_rebalance_settings' : ActorMethod<[RebalanceSettings], Result_7>,
  /**
   * Controller-only, and it sets both roles at once: a deploy hands out the pair, and
   * there is no path that leaves one of them stale.
   */
  'set_roles' : ActorMethod<[Principal, Principal], Result_13>,
  /**
   * The watcher's, or a controller's. Adds `add` to the sanctions set and then removes
   * `remove` from it, and answers how many addresses the set holds after. An EVM address is
   * held by its bytes, so any spelling of it is the same entry; other text is held exactly.
   * Compliance data, not money, so the halt switch does not gate it: ops halting on a
   * divergence still want the list current.
   * 
   * The set is bounded, and a call that would take it past the bound is refused whole, with
   * nothing of it written. Every text is held to the 256-byte cap and a longer one is refused
   * by its position, also with nothing written.
   */
  'set_sanctioned' : ActorMethod<[Array<string>, Array<string>], Result_14>,
  /**
   * Every transaction the canister signed after `after_id`, oldest first, at most `limit`
   * of them (capped). The watcher broadcasts them; the canister's own broadcast is the
   * backup.
   */
  'signed_txs' : ActorMethod<[bigint, bigint], Array<SignedTx>>,
  /**
   * Any caller, refused while halted, while the pool is closed, for a sanctioned party, and past
   * five calls a minute or thirty an hour (this door and `swap_from_icp` together).
   * Stakes `amount` of the caller's own ckUSDC (from `from_subaccount`), pulled with
   * `icrc2_transfer_from` on the caller's approval of the canister (its main account; the
   * approval covers `amount` and the ledger's fee), for `owner`, within the TVL cap; mints
   * its shares at the pool's price before it. A pull whose answer was lost answers
   * `Unavailable`, and the canister asks again with the same pull.
   */
  'stake_icp' : ActorMethod<[StakeIcpArgs], Result_15>,
  /**
   * Any caller, refused while halted, while the pool is closed, for a sanctioned party, and
   * past five calls a minute or thirty an hour (this door and `stake_icp` together): an
   * ICP user swaps `amount_in` of ckUSDC or a listed ICP token (pulled with
   * `icrc2_transfer_from` on the caller's approval of the canister) to any token on an EVM
   * chain, with the quoter's payout plan (the order for the payout it expects, its gas) and
   * one slippage of at most 500 bps; the recipient, token, chain and least out are the plan's.
   * Opened only while the Base pocket can pay it. The token reaches ckUSDC through its route
   * (at least the sale floor, half the slippage below what the plan needs, or it is refunded
   * to `refund_to`); the payout from the Base pocket is the ckUSDC less the pool's premium on
   * it and the flat network fee, paid with an order built at that exact amount. Answers the
   * payout's id and where it stands; a pull the ledger refused answers its refusal.
   */
  'swap_from_icp' : ActorMethod<[IcpSwapTerms], Result_16>,
  'verify_chain' : ActorMethod<[], boolean>,
  'verify_replay' : ActorMethod<[], boolean>,
  'version' : ActorMethod<[], string>,
  /**
   * Any caller (the 65-byte EIP-712 signature proves the staker; the watcher's
   * `POST /v2/withdraw` forwards here), refused while halted, while the pool is closed, and for
   * a sanctioned party. Burns the shares `usdc` is worth (rounded up, at most `max_shares` and
   * the staker's own), keeps the rebalancing share in the pool and the network fee on Base, and
   * opens a payout of the rest from the Base pocket, waiting for its order or queued while the
   * pocket is short. One nonce per staker, once. Answers the payout's id and the shares burned.
   */
  'withdraw_evm' : ActorMethod<
    [EvmWithdrawal, Uint8Array | number[]],
    Result_17
  >,
  /**
   * The ICP owner of the shares (the caller, at its subaccount `from`), refused while halted,
   * while the pool is closed, and for a sanctioned party. Burns the shares `usdc` is worth
   * (rounded up, at most `max_shares`) and pays `to` all of it as `token_out` (ckUSDC, or a
   * listed token through its ICPSwap pool, at least `min_out`; below it, all of it as ckUSDC),
   * every ledger fee out of `usdc`. Refused when the ICP pocket's free ckUSDC is short (the
   * queue is P11b). A payout that does not finish in this call answers `Unavailable` with
   * the shares burned, and the canister's timer finishes it.
   */
  'withdraw_icp' : ActorMethod<[WithdrawIcpArgs], Result_18>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

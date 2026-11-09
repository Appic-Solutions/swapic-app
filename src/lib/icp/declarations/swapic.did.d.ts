import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

/**
 * AX13 and AX14's bounds: the least and the most a relayer keeps, in millionths of what is
 * deposited (`least_ppm < most_ppm <= 100,000`), and per destination chain an allowance for
 * the arrival's gas, in micro USD.
 */
export interface AcrossFeeConfig {
  'least_ppm' : number,
  'most_ppm' : number,
  'gas_allowance_usd6' : Array<[bigint, bigint]>,
}
/**
 * Across's contracts on one chain, EVM addresses.
 */
export interface AcrossPinsConfig {
  'swap_proxy' : string,
  'periphery' : string,
  'spoke_pool' : string,
  'multicall_handler' : string,
}
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
   * The rebalancing's rows, optional as the pool's.
   */
  'pool_move' : [] | [bigint],
  'release' : bigint,
  /**
   * The canister's claim of its own deferred Across refunds, optional as the pool's.
   */
  'across_claim' : [] | [bigint],
  /**
   * A controller's sweep, optional as the pool's.
   */
  'sweep' : [] | [bigint],
  'pool_ck_deposit' : [] | [bigint],
  'pool_approve' : [] | [bigint],
  /**
   * Eco's `cancelAndProve` of an unfilled intent, optional as the pool's.
   */
  'eco_rescue' : [] | [bigint],
  /**
   * The relay of an order that deposits on Across, optional as the pool's.
   */
  'relay_across' : [] | [bigint],
  /**
   * The pool's rows, optional: an absent one refuses its action.
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
   * The rebalancing's rows, optional as the pool's: a move's own order, its CCTP finish
   * (the limit the watcher finishes the canister's own move with), and a Base to ICP Eco
   * move's ck deposit on Ethereum.
   */
  'pool_move' : [] | [bigint],
  'release' : bigint,
  /**
   * The canister's claim of its own deferred Across refunds, optional as the pool's.
   */
  'across_claim' : [] | [bigint],
  /**
   * A controller's sweep (`sweep_evm`): a native transfer or a `USDC.transfer`, optional
   * as the pool's.
   */
  'sweep' : [] | [bigint],
  'pool_ck_deposit' : [] | [bigint],
  'pool_approve' : [] | [bigint],
  /**
   * Eco's `cancelAndProve` of an unfilled intent, optional as the pool's.
   */
  'eco_rescue' : [] | [bigint],
  /**
   * The relay of an order that deposits on Across, optional as the pool's.
   */
  'relay_across' : [] | [bigint],
  /**
   * The pool's rows, optional: an absent one refuses its action.
   */
  'pool_payout' : [] | [bigint],
  'relay_eco' : bigint,
  'pool_move_finish' : [] | [bigint],
}
/**
 * Why an event was not appended. Nothing was written.
 */
export type AppendError = { 'LogFull' : null } |
  { 'Transition' : TransitionError } |
  { 'IndexMismatch' : { 'sealed' : bigint, 'log_len' : bigint } } |
  {
    'OutOfStableMemory' : { 'current_pages' : bigint, 'delta_pages' : bigint }
  };
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
 * A chain's head and gas price as the watcher read them, handed with the call that makes
 * the canister sign (`relay_gasless`, `finish_cctp`, `pay_payout`). There is no instant on
 * it: the canister stamps what it receives, so nothing a caller sends can date its data
 * forward.
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
 * The chain a signed transaction is for.
 */
export type ChainRef = { 'Evm' : bigint } |
  { 'Solana' : null };
/**
 * A controller's answer to a withdrawal through the ck minter (`resolve_ck_withdrawal`).
 */
export type CkResolution = {
    /**
     * Its USDC was found paid on Ethereum in this transaction, the minter's word not come.
     */
    'Delivered' : { 'tx_hash' : Uint8Array | number[] }
  } |
  {
    /**
     * A stopped withdrawal read again: nothing moves.
     */
    'Retry' : null
  } |
  {
    /**
     * Its ckUSDC is back in its burn subaccount though the minter never said so: the way
     * back starts. Refused unless the subaccount holds the whole sum.
     */
    'Reimbursed' : null
  };
/**
 * The ck minter's slow route, the numbers door and quote read alike.
 */
export interface CkSettings {
  /**
   * Whether `swap_from_icp_ck` takes new swaps.
   */
  'open' : boolean,
  /**
   * Micro USDC, the least network fee a swap carries: at or above
   * `ck_swap_fee_allowance` at ETH's price.
   */
  'min_network_fee' : bigint,
  /**
   * Wei of ckETH, the most the minter may burn for one swap's gas.
   */
  'ck_swap_fee_allowance' : bigint,
}
/**
 * An ICP user's swap through the ck minter, when the pool cannot carry it: USDC on Ethereum,
 * paid by the minter to the recipient.
 */
export interface CkSwapTerms {
  /**
   * ckUSDC or a listed ICP token.
   */
  'token_in' : Principal,
  /**
   * Ethereum.
   */
  'dst_chain' : bigint,
  /**
   * The least USDC the recipient gets.
   */
  'min_out' : bigint,
  /**
   * An EVM address: the minter pays it directly.
   */
  'recipient' : string,
  /**
   * The least ckUSDC the sale must make: at least `min_out`, `network_fee` and two ckUSDC
   * ledger fees.
   */
  'min_usdc' : bigint,
  'from_subaccount' : [] | [Uint8Array | number[]],
  /**
   * Default: the caller's account.
   */
  'refund_to' : [] | [IcpAccount],
  /**
   * 5 minutes to 1 hour ahead: at its burn the swap is past undoing, and before it the
   * deadline refunds it.
   */
  'deadline_ns' : bigint,
  /**
   * Pulled with `icrc2_transfer_from` from the caller's account.
   */
  'amount_in' : bigint,
  /**
   * USDC on Ethereum.
   */
  'token_out' : string,
  /**
   * Micro USDC: at least the route's least network fee (`payout_settings`).
   */
  'network_fee' : bigint,
}
/**
 * Every knob the canister reads at runtime. The rpc urls, the chain table and the key name
 * are what a deploy fills in.
 */
export interface Config {
  /**
   * The 2 bytes Across credits Swapic's deposits to, as `0x` and 4 hex digits; appended to
   * the data of every transaction the canister signs with an Across step. Absent: nothing.
   */
  'across_integrator' : [] | [string],
  'confirmations' : Array<[bigint, bigint]>,
  /**
   * How long the outbox holds signed transactions back to send them together.
   */
  'batch_window_ms' : bigint,
  'ecdsa_key_name' : string,
  /**
   * The chain the pool's EVM pocket is on, whose books the pool's guard reads. None:
   * the pool is closed.
   */
  'pool_chain' : [] | [bigint],
  'rpc_urls' : Array<[bigint, string]>,
  /**
   * How often the pool's Base USDC and ICP ckUSDC are checked against the books: 3,600
   * by default.
   */
  'books_check_interval_s' : bigint,
  /**
   * Whether the canister simulates a transaction itself before it signs it. False by
   * default: the watcher and the submit API simulate before they ask.
   */
  'simulate_before_sign' : boolean,
  /**
   * How often the engine's backstop drives while a payout, an ICP op or a move is open,
   * at most 60. Nothing drives on it while no work is open.
   */
  'backstop_interval_s' : bigint,
  /**
   * AX13 and AX14's bounds on an Across deposit. Absent: no order with an Across step is
   * relayed.
   */
  'across_fee' : [] | [AcrossFeeConfig],
  /**
   * Whether the Eco rail may be used. False until its route is designed.
   */
  'eco_enabled' : boolean,
  /**
   * The chains whose signed transactions the canister never broadcasts itself: the watcher
   * sends them through its private node. Absent or empty: every chain as today.
   */
  'private_send_chains' : [] | [BigUint64Array | bigint[]],
  /**
   * The chains whose transactions are final at the chain's own finalized block (the
   * `finalized` tag) instead of a block count; their depths decide nothing. Only Polygon
   * (137) and BNB Chain (56) may be named (`NotFinalizable`). Absent or empty: block counts
   * everywhere.
   */
  'finalized_chains' : [] | [BigUint64Array | bigint[]],
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
  /**
   * How far below what the books expect a balance may read, in micro-USDC, before the
   * pool pauses.
   */
  'books_tolerance' : bigint,
  /**
   * Eco's `Portal`, the same address on every chain.
   */
  'eco_portal' : [] | [string],
  /**
   * The crediting depth per chain: how deep money arriving at the canister (a deposit,
   * a ck minter withdrawal's USDC, the books' balance read) must be before it is
   * credited. Absent, or a chain with no entry: the chain's `confirmations`, the swap
   * depth. Ethereum's is refused below 12 (`DepthTooShallow`), and crediting there never
   * reads below 12 whatever is set.
   */
  'credit_confirmations' : [] | [Array<[bigint, bigint]>],
  'max_batch_items' : number,
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
     * `across_integrator` is not `0x` and 4 hex digits.
     */
    'NotAnIntegratorId' : null
  } |
  {
    /**
     * `across_fee`: `least_ppm` is not under `most_ppm`, or `most_ppm` is above 100,000.
     */
    'AcrossFeeOutOfRange' : { 'least_ppm' : number, 'most_ppm' : number }
  } |
  {
    /**
     * `evm_chains[chain_id].block_time_ms` is outside 100 to 60,000.
     */
    'BlockTimeOutOfRange' : { 'chain_id' : bigint, 'block_time_ms' : bigint }
  } |
  {
    'CapOutOfRange' : { 'cap' : number, 'field' : string, 'ceiling' : number }
  } |
  {
    /**
     * `evm_chains[chain_id].usdc_decimals` is outside 6 to 18.
     */
    'UsdcDecimalsOutOfRange' : { 'decimals' : number, 'chain_id' : bigint }
  } |
  {
    /**
     * The text in `field` at `chain_id` is not an EIP-712 domain name or version: 1 to 32
     * printable ASCII characters.
     */
    'NotDomainText' : { 'field' : string, 'chain_id' : bigint }
  } |
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
     * `finalized_chains` names a chain that may not wait for a finalized block.
     */
    'NotFinalizable' : { 'chain_id' : bigint }
  } |
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
 * `icrc21_consent_info`.
 */
export interface ConsentInfo {
  'metadata' : ConsentMessageMetadata,
  'consent_message' : ConsentMessage,
}
/**
 * `icrc21_consent_message`.
 */
export type ConsentMessage = { 'FieldsDisplayMessage' : FieldsDisplay } |
  { 'GenericDisplayMessage' : string };
/**
 * `icrc21_consent_message_metadata`.
 */
export interface ConsentMessageMetadata {
  /**
   * Minutes east of UTC. In a request, None is UTC; in an answer, None says the message
   * holds no local time.
   */
  'utc_offset_minutes' : [] | [number],
  /**
   * A BCP-47 language tag.
   */
  'language' : string,
}
/**
 * `icrc21_consent_message_request`: the call a signer is about to make.
 */
export interface ConsentMessageRequest {
  /**
   * Its candid argument, byte for byte as the signer would send it.
   */
  'arg' : Uint8Array | number[],
  /**
   * The method the signer would call on this canister.
   */
  'method' : string,
  'user_preferences' : ConsentMessageSpec,
}
/**
 * `icrc21_consent_message_response`. A variant of its own rather than a `Result`, so the
 * did gains no `Result_N` and every existing one keeps its number.
 */
export type ConsentMessageResponse = { 'Ok' : ConsentInfo } |
  { 'Err' : Icrc21Error };
/**
 * `icrc21_consent_message_spec`.
 */
export interface ConsentMessageSpec {
  'metadata' : ConsentMessageMetadata,
  /**
   * None: the canister picks (this one: the generic display).
   */
  'device_spec' : [] | [DeviceSpec],
}
/**
 * A controller's answer to a deposit held for a human (`resolve_deposit`): back to its
 * payout with fresh attempts, what arrived back to its payer on Base, or its transfer found
 * landed in ledger block `block`.
 */
export type DepositResolution = { 'Refund' : null } |
  { 'MarkPaid' : { 'block' : bigint } } |
  { 'Retry' : null };
/**
 * The display a signer shows a message on.
 */
export type DeviceSpec = {
    /**
     * Markdown, no external resources.
     */
    'GenericDisplay' : null
  } |
  {
    /**
     * Titled fields of plain text.
     */
    'FieldsDisplay' : null
  };
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
 * `icrc21_error_info`: a description for developers, never shown to the user.
 */
export interface ErrorInfo { 'description' : string }
/**
 * One entry of the log, kept forever. `index` counts from zero with no gap; `time_ns` is
 * IC time in nanoseconds.
 */
export interface Event {
  'index' : bigint,
  'time_ns' : bigint,
  'payload' : EventType,
}
/**
 * What happened. A `Flow`, `Books` or `Pool` line carries its step as `step_bytes`, the
 * step's minicbor encoding, with `step` its name and `detail` a readable rendering.
 */
export type EventType = {
    /**
     * A controller's sweep, its amount taken off the books it came from as it was signed
     * (EVM) or asked of the ledger (ICP). `amount` is in the asset's smallest unit.
     */
    'Swept' : {
      'id' : bigint,
      'to' : SweepTarget,
      'asset' : SweepAsset,
      /**
       * Of `amount`, what came off the chain books' `fee_income`. Zero but for USDC.
       */
      'from_fee_income' : bigint,
      /**
       * Of `amount`, what came off the pool ledger's fee line: `fees_base` for USDC on
       * the pool chain, `fees_icp` for ckUSDC. Zero for native gas, ckETH and ICP.
       */
      'from_pool_fees' : bigint,
      'amount' : bigint,
    }
  } |
  {
    /**
     * A step of a flow: a gasless relay, or a CCTP finish.
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
     * A transaction the canister signed reached its end: mined at the depth the outbox
     * waits for (`tx_hash` the one that landed), or its nonce spent by a cancel.
     */
    'TxFinal' : {
      'chain_id' : bigint,
      'nonce' : bigint,
      'tx_hash' : Uint8Array | number[],
      'outcome' : TxOutcome,
      'purpose' : TxPurpose,
    }
  } |
  {
    /**
     * A step of the pool.
     */
    'Pool' : {
      'step' : string,
      'detail' : string,
      'step_bytes' : Uint8Array | number[],
    }
  } |
  {
    /**
     * A step of a chain's USDC books: a fee earned, a check that found a shortfall or a
     * new surplus, a pause.
     */
    'Books' : {
      'step' : string,
      'detail' : string,
      'step_bytes' : Uint8Array | number[],
      'chain_id' : bigint,
    }
  } |
  {
    /**
     * A sweep that moved nothing (reverted, cancelled, or refused by the ledger): its
     * amount is back on the books it came from.
     */
    'SweepReverted' : { 'id' : bigint, 'why' : string }
  } |
  {
    /**
     * Principals as text, so the line reads without a decoder.
     */
    'RolesChanged' : { 'watcher' : string, 'quoter' : string }
  } |
  {
    /**
     * `json` is the public view of the config written: JSON of `Config` with every rpc url
     * as `"***"`.
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
       * `complete_swap`, `sweep`, ...).
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
 * One EVM chain as design C runs on it: its Swapic deployment, CCTP v2, its USDC, its
 * block time, and per action the gas limit, the gas budget and the least fee. Addresses
 * are EVM addresses.
 */
export interface EvmChainConfig {
  /**
   * Across's contracts here. Absent: no Across step from, to or on this chain is relayed.
   */
  'across' : [] | [AcrossPinsConfig],
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
   * USDC's EIP-712 domain version on this chain, as its contract answers `version()`.
   * None: "2". 1 to 32 printable ASCII characters.
   */
  'usdc_domain_version' : [] | [string],
  /**
   * The decimals of `usdc`, 6 to 18. Absent: 6. BNB Chain's (Binance's) USDC: 18.
   */
  'usdc_decimals' : [] | [number],
  /**
   * The least fee step, in USDC units, each action needs.
   */
  'min_network_fee' : ActionAmounts,
  /**
   * USDC's EIP-712 domain name on this chain, as its contract answers `name()`: what a
   * 3009 authorization is signed under. None: "USD Coin". 1 to 32 printable ASCII
   * characters.
   */
  'usdc_domain_name' : [] | [string],
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
   * How often the chain makes a block, 100 to 60,000: the outbox reads a transaction's
   * receipt at this pace.
   */
  'block_time_ms' : bigint,
  /**
   * CCTP v2's `MessageTransmitterV2`.
   */
  'message_transmitter' : string,
}
/**
 * What `sweep_evm` sends from the canister's address on an EVM chain.
 */
export type EvmSweepAsset = {
    /**
     * USDC fee income booked on the chain, in micro USDC.
     */
    'FeeUsdc' : null
  } |
  {
    /**
     * The chain's native gas, in wei.
     */
    'Native' : null
  };
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
   * Micro USDC out of `usdc`, Swapic's: the payout's own gas.
   */
  'network_fee' : bigint,
  'payout' : PayoutTerms,
  /**
   * Micro USDC out of `usdc`, Swapic's: the cost of one ICP to Base move at live gas, as
   * the quoter priced it.
   */
  'move_fee' : bigint,
}
/**
 * A fields display's message: its intent and its titled values.
 */
export interface FieldsDisplay {
  'fields' : Array<[string, Value]>,
  'intent' : string,
}
/**
 * A chain that waits for its finalized block, as the outbox last read it.
 */
export interface FinalizedSeen {
  /**
   * It has stood still ten minutes or more while something on the chain waits: nothing
   * on it closes until it moves. An idle chain is never stalled.
   */
  'stalled' : boolean,
  /**
   * When it last moved, IC time in nanoseconds (or when its clock last started).
   */
  'moved_at_ns' : bigint,
  /**
   * The last finalized block a read gave; none before any did.
   */
  'number' : [] | [bigint],
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
 * What the flows and the rebalancing read at runtime, beside `Config`. Set by a controller.
 */
export interface FlowSettings {
  /**
   * The ckETH ledger, when the minter charges the withdrawal's gas in ckETH: the
   * canister approves the minter for `cketh_fee_allowance` of it before a withdrawal.
   */
  'cketh_ledger' : [] | [Principal],
  'cketh_fee_allowance' : bigint,
  /**
   * The ckETH minter, which withdraws ckERC20 tokens too: an ICP to Base move's ckUSDC
   * leaves ICP through it.
   */
  'ck_minter' : [] | [Principal],
  /**
   * Eco's prover, the one a rebalance proposal's intent may name: an intent proven by
   * any other pays its reward to whoever that prover says.
   */
  'eco_prover' : [] | [string],
  /**
   * The furthest ahead a relayed order's deadline may be.
   */
  'relay_window_s' : bigint,
  /**
   * The ck minter's ERC-20 deposit helper on Ethereum (`depositErc20` with subaccounts):
   * a Base to ICP rebalance move filled by Eco is deposited through it.
   */
  'ck_helper' : [] | [string],
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
 * The token/ckUSDC pool, the token/ICP pool, or the token's pool against a hub, a token listed
 * Direct whose own ckUSDC pool ends the route.
 */
export type IcpRouteVia = {
    'Hub' : { 'hub' : Principal, 'pool' : Principal }
  } |
  { 'Icp' : Principal } |
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
/**
 * What `sweep_icp` sends from the canister's ICP accounts.
 */
export type IcpSweepAsset = {
    /**
     * The canister's ICP, in e8s.
     */
    'Icp' : null
  } |
  {
    /**
     * The pool's ICP fee line, in micro ckUSDC.
     */
    'CkUsdcFees' : null
  } |
  {
    /**
     * The canister's ckETH, in wei.
     */
    'CkEth' : null
  };
export interface IcpTokenEntry {
  'ledger' : Principal,
  'icpswap_pool' : Principal,
}
/**
 * `icrc21_error`, the two cases this canister answers.
 */
export type Icrc21Error = {
    /**
     * A call the canister refuses: another method, or an argument its door would not take.
     */
    'UnsupportedCanisterCall' : ErrorInfo
  } |
  {
    /**
     * A call the canister cannot describe now: what reading it needs is not set yet.
     */
    'ConsentMessageUnavailable' : ErrorInfo
  };
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
 * The payout plan: the quoter's ready-made Swapic order for the expected
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
  { 'MarkPaid' : null } |
  {
    /**
     * Back on the path it stopped on: stopped legs quoted again, a ck withdrawal read again.
     */
    'Retry' : null
  };
export interface PayoutSettings {
  /**
   * The ck minter's slow route. None: off.
   */
  'ck' : [] | [CkSettings],
  /**
   * Micro USDC, the most the Across payouts in flight may hold together (signed,
   * delivering, or owed back by Across). None: no Across payout is signed.
   */
  'across_in_flight_max' : [] | [bigint],
  /**
   * Micro USDC, the least a payout's network fee may be.
   */
  'min_network_fee' : bigint,
  /**
   * How long a waiting payout waits for a valid order before it is retried, then undone
   * at its deadline.
   */
  'order_wait_s' : bigint,
  /**
   * Whether a payout may leave Base over CCTP. Its least network fee per destination is
   * the pool chain's `min_network_fee.relay_cctp` plus the destination's
   * `min_network_fee.complete_swap` (a token out) or `relay_deliver` (USDC out).
   */
  'cctp_payouts' : boolean,
  /**
   * The most gas a payout order may be signed with on Base.
   */
  'max_payout_gas' : bigint,
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
     * Its order ran on Base and published an Eco intent or made an Across deposit: paid once
     * its fill is read.
     */
    'Delivering' : null
  } |
  {
    /**
     * Through the ck minter: its withdrawal is on its way, nothing burned yet.
     */
    'CkWithdrawing' : null
  } |
  { 'Paid' : null } |
  { 'Pulling' : null } |
  { 'Swapping' : null } |
  {
    /**
     * Through the ck minter: burned. Its USDC reaches the recipient from the minter directly.
     */
    'CkWithdrawn' : null
  } |
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
  /**
   * Through the ck minter: what it burns and pays, once its withdrawal began.
   */
  'ck_amount' : [] | [bigint],
  'order_id' : [] | [Uint8Array | number[]],
  /**
   * Through the ck minter: the minter's id of its withdrawal, once burned.
   */
  'ck_withdrawal_id' : [] | [bigint],
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
   * Micro USDC, the payout's own network fee: the watcher chooses CCTP only when it
   * covers the canister's CCTP costs.
   */
  'network_fee' : [] | [bigint],
}
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
/**
 * A report of USDC that reached the canister's Base address in `base_tx`.
 */
export interface PoolArrival {
  'base_tx' : Uint8Array | number[],
  /**
   * The order's memo, the deposit's encoded terms: taken only when its keccak is the ref
   * the transfer's proof carries. None: the canister reads it from the order's
   * `OrderStarted` itself.
   */
  'memo' : [] | [Uint8Array | number[]],
  /**
   * The chain the order ran on: the pool chain for a same-chain deposit.
   */
  'src_chain' : bigint,
  /**
   * The order's own transaction on `src_chain`; empty when it is `base_tx`.
   */
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
  'move_fee' : bigint,
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
     * No longer answered: the canister enforces no per swap cap; kept, the wire
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
  {
    /**
     * An Across deposit from another chain, filled to the canister on the pool chain.
     */
    'Across' : null
  } |
  { 'SameChain' : null };
export interface PoolSettings {
  /**
   * Micro USDC, launch 1_000_000_000 ($1,000): the quoter's per swap cap, which the
   * canister stores and shows but enforces nowhere.
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
   * Micro USDC, the least move fee of an EVM stake and of an ICP withdrawal (each pays
   * for one Base to ICP move). Absent: 0.
   */
  'least_move_fee_base_to_icp' : [] | [bigint],
  /**
   * The pool chain's blocks a large deposit waits. Absent: 6.
   */
  'large_deposit_confirmations' : [] | [bigint],
  /**
   * Off until a controller opens the pool for swaps.
   */
  'pool_open_for_swaps' : boolean,
  /**
   * How often the canister reads Base itself, its backup of the reports (default 3,600).
   */
  'arrival_backup_s' : bigint,
  /**
   * Micro USDC: a deposit whose one transfer is above this waits
   * `large_deposit_confirmations` blocks before it is credited. Absent: 1_000_000_000
   * ($1,000).
   */
  'large_deposit_usdc' : [] | [bigint],
  /**
   * Micro USDC, the least move fee of an ICP stake and of an EVM withdrawal (each pays
   * for one ICP to Base move). Absent: 0.
   */
  'least_move_fee_icp_to_base' : [] | [bigint],
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
 * A pull a door made before writing anything whose outcome nobody could tell (audit C15):
 * nothing is written of it, so a human checks `ledger` for a transfer from `from` with this
 * memo and gives back what moved. The watcher alerts each once.
 */
export interface PullToCheck {
  'why' : string,
  'at_ns' : bigint,
  'from' : IcpAccount,
  'memo' : Uint8Array | number[],
  /**
   * The door, and whether its pull or its give-back ended unclear.
   */
  'what' : string,
  'ledger' : Principal,
  'amount' : bigint,
}
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
export type Result = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : string } |
  { 'Err' : SignError };
export type Result_10 = { 'Ok' : null } |
  { 'Err' : GuardError };
export type Result_11 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_12 = { 'Ok' : null } |
  { 'Err' : SetRolesError };
export type Result_13 = { 'Ok' : bigint } |
  { 'Err' : SetSanctionedError };
export type Result_14 = { 'Ok' : StakeIcpOk } |
  { 'Err' : PoolError };
export type Result_15 = { 'Ok' : SwapFromIcpOk } |
  { 'Err' : PoolError };
export type Result_16 = { 'Ok' : SweepEvmOk } |
  { 'Err' : SweepError };
export type Result_17 = { 'Ok' : SweepIcpOk } |
  { 'Err' : SweepError };
export type Result_18 = { 'Ok' : WithdrawEvmOk } |
  { 'Err' : PoolError };
export type Result_19 = { 'Ok' : WithdrawIcpOk } |
  { 'Err' : PoolError };
export type Result_2 = { 'Ok' : Config } |
  { 'Err' : GuardError };
export type Result_3 = { 'Ok' : PoolArrivalOutcome } |
  { 'Err' : PoolError };
export type Result_4 = { 'Ok' : PayPayoutOk } |
  { 'Err' : PoolError };
export type Result_5 = { 'Ok' : null } |
  { 'Err' : PoolError };
export type Result_6 = { 'Ok' : Array<PullToCheck> } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : PayPayoutOk } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : null } |
  { 'Err' : SetConfigError };
export type Result_9 = { 'Ok' : null } |
  { 'Err' : FlowCallError };
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
  /**
   * Micro ckUSDC out of `amount`, Swapic's: the cost of one ICP to Base move at live gas,
   * as the quoter priced it. Shares are minted on the rest.
   */
  'move_fee' : bigint,
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
 * One standard `icrc10_supported_standards` lists.
 */
export interface SupportedStandard { 'url' : string, 'name' : string }
/**
 * `swap_from_icp`'s answer: the payout's id, and where it stands as the call returns
 * (`Signed` when its plan fitted; `Waiting` when it waits for an order).
 */
export interface SwapFromIcpOk { 'id' : bigint, 'status' : PayoutStatus }
/**
 * What a logged sweep sent.
 */
export type SweepAsset = { 'Icp' : null } |
  { 'FeeUsdc' : null } |
  { 'CkUsdcFees' : null } |
  { 'Native' : null } |
  { 'CkEth' : null };
/**
 * Why a sweep sent nothing.
 */
export type SweepError = {
    /**
     * An argument the door does not take: the field and why.
     */
    'Invalid' : string
  } |
  {
    /**
     * The destination is sanctioned.
     */
    'Sanctioned' : null
  } |
  {
    /**
     * Open work may still need the asset: what is open.
     */
    'Busy' : string
  } |
  { 'Guard' : GuardError } |
  {
    /**
     * More than the books allow: what they allow now.
     */
    'AboveBooks' : { 'available' : bigint }
  } |
  {
    /**
     * The ledger refused the transfer: why. Nothing left the books.
     */
    'Ledger' : string
  } |
  {
    /**
     * A chain or a ledger did not answer usably: ask again.
     */
    'Unavailable' : string
  };
export interface SweepEvmArgs {
  /**
   * An EVM address: never the canister's own, the zero address or a sanctioned one.
   */
  'to' : string,
  'asset' : EvmSweepAsset,
  'chain_id' : bigint,
  /**
   * In the asset's smallest unit.
   */
  'amount' : bigint,
}
/**
 * `sweep_evm`'s answer: the sweep's id, and its signed transaction's id in `signed_txs`.
 */
export interface SweepEvmOk { 'id' : bigint, 'tx_id' : bigint }
export interface SweepIcpArgs {
  /**
   * Never the canister's own account.
   */
  'to' : IcpAccount,
  'asset' : IcpSweepAsset,
  /**
   * In the asset's smallest unit; the ledger's fee is paid on top, from the same account.
   */
  'amount' : bigint,
}
/**
 * `sweep_icp`'s answer: the sweep's id, and the ledger block of its transfer.
 */
export interface SweepIcpOk { 'id' : bigint, 'block' : bigint }
/**
 * Where a logged sweep sent to.
 */
export type SweepTarget = {
    /**
     * An EIP-55 address on `chain_id`.
     */
    'Evm' : { 'to' : string, 'chain_id' : bigint }
  } |
  { 'Icp' : IcpAccount };
export interface TextValue { 'content' : string }
/**
 * Unix seconds, which the signer writes in its user's zone.
 */
export interface TimestampSeconds { 'amount' : bigint }
/**
 * Why an event cannot move the state it was offered to.
 */
export type TransitionError = {
    'NonceNeverAllocated' : {
      'next' : bigint,
      'chain_id' : bigint,
      'nonce' : bigint,
    }
  } |
  {
    /**
     * A flow step refused, with the domain's reason.
     */
    'Flow' : string
  } |
  { 'Pool' : string } |
  { 'Books' : string } |
  { 'NonceStillUnsigned' : Uint8Array | number[] } |
  {
    'NonceOutOfSequence' : {
      'expected' : bigint,
      'chain_id' : bigint,
      'nonce' : bigint,
    }
  } |
  { 'NonceExhausted' : { 'chain_id' : bigint } } |
  { 'NonceNotUnsigned' : { 'chain_id' : bigint, 'nonce' : bigint } };
/**
 * How a transaction the canister signed ended.
 */
export type TxOutcome = { 'Reverted' : { 'block' : bigint } } |
  { 'Succeeded' : { 'block' : bigint } } |
  {
    /**
     * Its nonce was spent by a cancel: it never ran.
     */
    'Cancelled' : null
  };
/**
 * Why an outbound transaction exists.
 */
export type TxPurpose = {
    /**
     * A pool payout from the canister's Base pocket, by its payout id.
     */
    'PoolPayout' : bigint
  } |
  {
    /**
     * A controller's sweep, by its id.
     */
    'Sweep' : bigint
  } |
  {
    /**
     * Eco's `cancelAndProve` of an unfilled intent, by the order id that published it.
     */
    'EcoRescue' : Uint8Array | number[]
  } |
  {
    /**
     * The canister's claim of its own deferred Across refunds on that chain.
     */
    'AcrossClaim' : bigint
  } |
  {
    /**
     * The canister's standing USDC allowance to Swapic.
     */
    'PoolApprove' : null
  } |
  {
    /**
     * A gasless order relayed, by its relay key.
     */
    'Relay' : Uint8Array | number[]
  } |
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
  {
    /**
     * A CCTP arrival finished, by its finish key.
     */
    'Finish' : Uint8Array | number[]
  } |
  {
    /**
     * A same-nonce zero-value self-transfer on that chain.
     */
    'Cancel' : bigint
  };
/**
 * A field's value: the standard's `Value` less `TokenAmount` and `DurationSeconds`, which
 * this canister never sends (an amount is text it wrote exactly; no message holds a
 * duration).
 */
export type Value = { 'Text' : TextValue } |
  { 'TimestampSeconds' : TimestampSeconds };
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
  /**
   * Micro ckUSDC out of `usdc`, Swapic's: the cost of one Base to ICP move at live gas,
   * as the quoter priced it.
   */
  'move_fee' : bigint,
}
export interface WithdrawIcpOk { 'paid' : bigint, 'burned' : bigint }
export interface _SERVICE {
  /**
   * The book lines of every chain, in micro-USDC, with the last balance read.
   */
  'books' : ActorMethod<[], Array<[bigint, BookLines]>>,
  /**
   * Controller-only, refused while halted: claims what Across's SpokePool on the pool chain
   * (`chain_id`) holds back for the canister (BSC design 6.2.9), once its
   * `getRelayerRefund(USDC, canister)` reads above zero, signed with the chain's
   * `across_claim` gas row. One claim at a time on the chain. The USDC it brings is credited
   * as any Across refund to the canister, to the payouts Across owes back first. Answers the
   * signed transaction's id in `signed_txs`.
   */
  'claim_across_refund' : ActorMethod<[bigint], Result>,
  /**
   * Controller-only. Derives the canister's EVM address from its threshold key and caches
   * it, or answers the cached one. Deploy needs this before anything else: the Swapic
   * contracts are configured with this address and it has to be funded for gas, and neither
   * can wait for the first transaction to derive it.
   */
  'derive_evm_address' : ActorMethod<[], Result_1>,
  'event_count' : ActorMethod<[], bigint>,
  /**
   * `len` is capped server-side; ask for the count first and page through. A page may be
   * shorter than asked (its size): read on until a page comes back empty.
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
   * Each chain that waits for its finalized block: the last finalized block a read gave, when
   * it last moved (IC time in nanoseconds, or when its clock last started), and whether it has
   * stood still long enough, while something waits, to be a stall. Nothing on a stalled chain
   * closes until it moves.
   */
  'finalized_seen' : ActorMethod<[], Array<[bigint, FinalizedSeen]>>,
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
   * `reading`, when given, is `chain_id`'s head and gas price the watcher priced the finish
   * on, stored right after the role and the halt; an invalid one refuses the call. With none
   * the canister reads the gas price itself. A reading whose block is not above the stored
   * one's is kept out.
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
    Result
  >,
  /**
   * Public, so it answers with the redacted view; `get_config_full` is the ops door onto
   * the real thing.
   */
  'get_config' : ActorMethod<[], Config>,
  /**
   * The unredacted config, for ops. Controller-only, because `rpc_urls` holds api keys.
   */
  'get_config_full' : ActorMethod<[], Result_2>,
  /**
   * The flows' settings.
   */
  'get_flow_settings' : ActorMethod<[], FlowSettings>,
  /**
   * True once a controller stopped the canister with `set_halted`. While it is set nothing
   * is signed, sent or paid. Nothing clears it but a controller.
   */
  'halted' : ActorMethod<[], boolean>,
  /**
   * The ICP routes every ICP path of the pool reads: the ICP/ckUSDC pool, and each listed
   * token's route. Empty while none are set.
   */
  'icp_routes' : ActorMethod<[], IcpRoutesView>,
  /**
   * ICRC-10: the standards this canister implements, ICRC-10 itself and ICRC-21.
   */
  'icrc10_supported_standards' : ActorMethod<[], Array<SupportedStandard>>,
  /**
   * ICRC-21: a plain-words description of a call to `swap_from_icp`, `swap_from_icp_ck`, `stake_icp`,
   * `withdraw_icp` or `withdraw_evm`, read from its argument exactly as that door reads it,
   * for a wallet to show its user before it signs; an ICRC-21 error for any other call or an
   * argument the door would not take. Any caller, anonymous included; never halted; writes
   * nothing and awaits nothing. An update, as ICRC-21 declares it.
   */
  'icrc21_canister_call_consent_message' : ActorMethod<
    [ConsentMessageRequest],
    ConsentMessageResponse
  >,
  /**
   * Anyone (the watcher), refused while halted: an ICP to Base move's USDC reached the
   * canister's Base address in `base_tx` (and, for an Eco route, the order's `src_tx` on
   * `src_chain`; an empty `src_tx` names none). The canister reads the receipts itself, proves
   * the transfer carries the move's own ref (its CCTP envelope, or the Eco source's
   * `OrderStarted`), and credits the move once. A caller other than the watcher is held to 10
   * reports a minute in total and 3 an hour per `base_tx`, refused `Unavailable` before
   * any outcall.
   */
  'note_move_arrival' : ActorMethod<
    [bigint, Uint8Array | number[], bigint, Uint8Array | number[]],
    Result_3
  >,
  /**
   * Any caller (the watcher, or the user's app as a backup), refused while halted. A USDC
   * transfer to the canister's Base address in `base_tx` pays the deposit its order's memo
   * describes: the order ran in `base_tx` (same chain) or in `src_tx` on `src_chain` (CCTP,
   * Eco). The canister reads the receipts itself at the crediting depth, proves every
   * transfer to it against its rail, takes the memo (the one handed over, or the one in the
   * order's `OrderStarted`) only when its keccak is the ref the proof carries, and credits
   * the transfer at most once, and only when it brings at least the memo's `min_usdc`:
   * `Credited` (the payout follows on the canister's timer), or `Unattributed` with why,
   * held for a controller. `BadArrival` when no transfer carries the memo's ref. The
   * canister trusts only the chain and the hash. A caller other than the watcher and the
   * controllers is held to 2 reports a minute and 20 an hour in total and 3 an hour per
   * `base_tx`, refused `Unavailable` before any outcall; a report bringing the terms of a
   * transfer the canister already awaits is held only to its own 3 an hour per `base_tx`. While
   * the pool is closed a report with terms answers `Closed`, with nothing read or recorded.
   */
  'note_pool_arrival' : ActorMethod<[PoolArrival], Result_3>,
  /**
   * Watcher-only, refused while halted and while the pool is closed: the order the quoter
   * built for waiting payout `id` at its exact amount (`abi.encode` of an Order, its memo
   * empty), and the gas limit to sign it with. The canister checks the untrusted order
   * against the payout's own terms (payer the canister, Base USDC in, exactly the payout's
   * amount, no fee step, a CCTP burn only while CCTP payouts are on and the payout's network
   * fee covers the destination's floor, one delivery paying the recipient at least their
   * minimum of their token on their chain, an Eco intent's reward refunding the canister, a
   * deadline at least 60 s away and within the payout's, no sanctioned party, the gas within
   * `max_payout_gas`) and signs `Swapic.run(order)` from its own Base pocket. A payout signed
   * already answers its transaction's id; a retry after a revert signs only the order it
   * pinned.
   * 
   * `reading`, when given, is the pool chain's head and gas price the watcher priced the
   * payout on; with none the canister reads the gas price itself. A reading whose block is
   * not above the stored one's is kept out.
   */
  'pay_payout' : ActorMethod<
    [bigint, Uint8Array | number[], bigint, [] | [ChainData]],
    Result_4
  >,
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
  'pool_approve_ck_helper' : ActorMethod<[], Result_4>,
  /**
   * Controller-only, refused while halted, once per deploy and chain (Base, and Ethereum for
   * the moves to Base): reads the canister's USDC allowance to Swapic on `chain_id` and,
   * below 2^255, signs `USDC.approve(Swapic, 2^256 - 1)`, so every pool payout and move is one
   * signature of `Swapic.run`. Safe because `run` pulls only from `payer == msg.sender`. An
   * allowance already in place answers `Known`; an approval on its way answers `Unavailable`.
   */
  'pool_approve_swapic' : ActorMethod<[bigint], Result_4>,
  /**
   * A deposit by its ref, if one is registered under it.
   */
  'pool_deposit' : ActorMethod<[Uint8Array | number[]], [] | [PoolDepositView]>,
  /**
   * The orphans held for a controller: USDC at the canister's Base address no deposit could
   * take (no memo that hashes to its ref, below the memo's `min_usdc`, a ref credited
   * already, terms the pool refused), not refunded or booked yet.
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
    Result_5
  >,
  /**
   * The doors' pulls whose outcome nobody could tell, oldest first, for the watcher's alert and
   * a controller's check (audit C15: nothing is written of a pull before its money is in). Any
   * other caller is refused.
   */
  'pulls_to_check' : ActorMethod<[], Result_6>,
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
   * once per order id: a second call answers the first one's id. An order whose memo is
   * longer than 256 bytes is refused. Answers the signed transaction's id in `signed_txs`.
   * 
   * `reading`, when given, is `chain_id`'s head and gas price the watcher priced the relay
   * on, stored right after the role and the halt; an invalid one refuses the call. With none
   * the canister reads the gas price itself. A reading whose block is not above the stored
   * one's is kept out.
   */
  'relay_gasless' : ActorMethod<
    [
      bigint,
      Uint8Array | number[],
      Uint8Array | number[],
      bigint,
      [] | [ChainData],
    ],
    Result
  >,
  /**
   * Watcher-only, refused while halted: for the Eco intent the order `order_id` published (a
   * relayed order's, a pool payout's or a move's: one the canister signed for), once its fill
   * deadline passed with no fill, the canister reads the order's own transaction and the
   * intent's destination Portal itself and signs `cancelAndProve` there, paying the proof's
   * fee (the `eco_rescue` gas row bounds both); Eco refunds the reward's creator on the source
   * by itself. One rescue per order: a second call answers the first one's id. Every rescue
   * is logged.
   */
  'rescue_eco_intent' : ActorMethod<[Uint8Array | number[]], Result_7>,
  /**
   * Controller-only, refused while halted. A withdrawal through the ck minter that the canister
   * stopped, or that the minter leaves open: `Retry` reads a stopped one again, `Delivered`
   * closes one found paid on Ethereum, `Reimbursed` starts the way back for one whose ckUSDC is
   * back in its subaccount without the minter's word (a quarantined reimbursement), and only
   * then. Nothing here refunds on a controller's word alone.
   */
  'resolve_ck_withdrawal' : ActorMethod<[bigint, CkResolution], Result_5>,
  /**
   * Controller-only, refused while halted: an EVM to ICP deposit held for a
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
    Result_5
  >,
  /**
   * Controller-only, refused while halted: a stuck move sent on from where it stands
   * (`Retry`: a reverted order signed again, the same one; a minter's call a controller found
   * never ran asked again; a wait read again), or written off with why (`Lost`).
   */
  'resolve_move' : ActorMethod<[bigint, MoveResolution], Result_5>,
  /**
   * Controller-only, refused while halted (orphans are ALWAYS held for a
   * controller): resolves the orphan under `key` (its 48 bytes, as `pool_orphans` lists it)
   * once. `Refund { to }` signs `USDC.transfer(to, amount - min_network_fee)` on Base, the
   * fee kept for its gas; `Book` books it to the Base books' unattributed line.
   */
  'resolve_orphan' : ActorMethod<
    [Uint8Array | number[], OrphanAction],
    Result_5
  >,
  /**
   * Controller-only, refused while halted: a payout stopped for a human
   * (`Failed`), resolved once. `Refund`: back on its undo, an ICP swap's refund asked next (all
   * its ckUSDC less one ledger fee, or its token), a withdrawal's shares minted back at once;
   * the controller checked no refund went out before. `MarkPaid`: its signed order ran after
   * all, and its paid line is booked.
   */
  'resolve_payout' : ActorMethod<[bigint, PayoutResolution], Result_5>,
  /**
   * Controller-only, refused while halted: an ICP stake whose pull's answer
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
    Result_5
  >,
  /**
   * Controller-only, and it takes the whole record, so editing one knob is a
   * read-modify-write: read with `get_config_full`, never with the redacted `get_config`,
   * or the write puts "***" into `rpc_urls` and is refused.
   */
  'set_config' : ActorMethod<[Config], Result_8>,
  /**
   * Controller-only. The ck canisters, the relay window and the rebalancing's addresses.
   */
  'set_flow_settings' : ActorMethod<[FlowSettings], Result_9>,
  /**
   * Controller-only, both ways: `true` is an emergency stop, `false` lifts it.
   * 
   * Lifting the halt wakes the outbox and the engine's backstop: neither re-arms itself on a
   * halted canister, so this is what puts them back when a queued transaction, an allocation
   * waiting for its cancel or an open payout was held back by the halt.
   */
  'set_halted' : ActorMethod<[boolean], Result_10>,
  /**
   * Controller-only, refused while halted. Sets the ICP routes (interface section 3c): the
   * ICP/ckUSDC pool, and each listed token's route, directly through its ckUSDC pool or
   * through ICP. Reads the ICP ledger off the ICP/ckUSDC pool and every route ledger's fee.
   * No token has a size cap of its own: the pool's per swap cap applies.
   */
  'set_icp_routes' : ActorMethod<[[] | [Principal], Array<IcpRoute>], Result_5>,
  /**
   * Controller-only, refused while halted. Sets the Base payouts' knobs: the least network
   * fee, how long a waiting payout waits for an order, the most gas a payout order is signed
   * with, whether a payout may leave Base over CCTP, and the ck route. Settings that name no ck
   * route shut its door and keep its numbers.
   */
  'set_payout_settings' : ActorMethod<[PayoutSettings], Result_5>,
  /**
   * Controller-only. Pauses the pool (`true`), or reopens it (`false`), which also clears a
   * shortfall the last balance check latched, once someone has looked at it. Recorded in
   * the log on the pool chain's books; the pool's guard reads it.
   */
  'set_pool_paused' : ActorMethod<[boolean], Result_11>,
  /**
   * Controller-only, refused while halted. Sets the pool's knobs after reading the ckUSDC
   * ledger's fee and every listed token's (`icrc1_fee`), which the ICP fees' floor at an
   * arrival reads.
   */
  'set_pool_settings' : ActorMethod<[PoolSettings], Result_5>,
  /**
   * Controller-only, refused while halted: the rebalancing's knobs, held together.
   */
  'set_rebalance_settings' : ActorMethod<[RebalanceSettings], Result_5>,
  /**
   * Controller-only, and it sets both roles at once: a deploy hands out the pair, and
   * there is no path that leaves one of them stale.
   */
  'set_roles' : ActorMethod<[Principal, Principal], Result_12>,
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
  'set_sanctioned' : ActorMethod<[Array<string>, Array<string>], Result_13>,
  /**
   * Every transaction the canister signed after `after_id`, oldest first, at most `limit`
   * of them (capped). The watcher broadcasts them; the canister's own broadcast is the
   * backup.
   */
  'signed_txs' : ActorMethod<[bigint, bigint], Array<SignedTx>>,
  /**
   * Any caller but the anonymous one, refused while halted, while the pool is closed, and for
   * a sanctioned party; the pull comes before anything is written (audit C15).
   * Stakes `amount` of the caller's own ckUSDC (from `from_subaccount`), pulled with
   * `icrc2_transfer_from` on the caller's approval of the canister (its main account; the
   * approval covers `amount` and the ledger's fee), for `owner`, within the TVL cap: books
   * `move_fee` to Swapic's ICP fee line and mints shares on the rest at the pool's price
   * before it. A pull whose outcome is unclear answers `Unavailable` with nothing written, and
   * is kept in `pulls_to_check` for a human to check and give back.
   */
  'stake_icp' : ActorMethod<[StakeIcpArgs], Result_14>,
  /**
   * Any caller but the anonymous one, refused while halted, while the pool is closed, and for a
   * sanctioned party; the pull comes before anything is written (audit C15): an
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
  'swap_from_icp' : ActorMethod<[IcpSwapTerms], Result_15>,
  /**
   * Any caller but the anonymous one, refused while halted, while the pool is closed, while the
   * route's switch is off, short of ckETH, and for a sanctioned party; the pull comes before
   * anything is written (audit C15): an
   * ICP user swaps `amount_in` of ckUSDC or a listed ICP token to USDC on Ethereum through the
   * ck minter, when the pool cannot carry it. The minter pays the recipient directly.
   * `network_fee` is at least the route's floor (`payout_settings`), no premium is taken, and
   * both ckUSDC ledger fees of the way out are the user's: at least `min_usdc` must come of the
   * sale, or it is refunded. The recipient gets what the sale made less those, at least
   * `min_out`, or a refund on ICP, all or nothing; a refund after the minter burned keeps the
   * network fee. Answers like `swap_from_icp`, and `payout(id)` tells where it stands.
   */
  'swap_from_icp_ck' : ActorMethod<[CkSwapTerms], Result_15>,
  /**
   * Controller-only, refused while halted. Sends `amount` of the canister's own `asset` on
   * `chain_id` to `to`, signed from the canister's address with the chain's `sweep` gas row
   * at a gas price the canister reads itself:
   * 
   * - `Native`: the chain's gas coin, refused while any transaction of the canister on that
   * chain is still open (it may need the gas for a fee bump), and past the balance less the
   * sweep's own gas (the chain's `sweep` budget, or the worst L2 cost if that is more).
   * - `FeeUsdc`: `USDC.transfer` of booked fee income only: at most the chain books' fee
   * income, plus the pool's Base fee line on the pool chain. The amount leaves the books
   * as the transaction is signed and comes back if it reverts or is cancelled.
   * 
   * Refused for the canister's own address, the zero address and a sanctioned one. Answers
   * the sweep's id and its transaction's id in `signed_txs`.
   */
  'sweep_evm' : ActorMethod<[SweepEvmArgs], Result_16>,
  /**
   * Controller-only, refused while halted. Sends `amount` of the canister's own `asset` on
   * ICP to `to`, the ledger's fee paid on top from the same account:
   * 
   * - `CkUsdcFees`: at most the pool's ICP fee line, never the ICP pocket's ckUSDC.
   * - `CkEth`: refused while a rebalancing move is open (its minter withdrawal spends
   * ckETH).
   * - `Icp`: refused while an ICP swap or withdrawal is open (a route through ICP holds
   * the user's ICP between its legs).
   * 
   * The amount leaves the books before the transfer is asked and comes back if the ledger
   * refuses it. Refused for the canister's own account. Answers the sweep's id and the
   * ledger block of its transfer.
   */
  'sweep_icp' : ActorMethod<[SweepIcpArgs], Result_17>,
  'version' : ActorMethod<[], string>,
  /**
   * The canister's cycles balance, for the watcher's low cycles alert alone: a balance anyone
   * could read would tell an outsider how far the canister is from freezing. Any other caller is
   * refused. The balance saturates at `u64::MAX` (about 18 million T), far above any real one.
   */
  'watcher_cycles_balance' : ActorMethod<[], Result>,
  /**
   * Any caller (the 65-byte EIP-712 signature proves the staker; the watcher's
   * `POST /v2/withdraw` forwards here), refused while halted, while the pool is closed, and for
   * a sanctioned party. Burns the shares `usdc` is worth (rounded up, at most `max_shares` and
   * the staker's own), books the move fee and the network fee to Swapic's Base fee line, and
   * opens a payout of the rest from the Base pocket, waiting for its order or queued while the
   * pocket is short. One nonce per staker, once. Answers the payout's id and the shares burned.
   */
  'withdraw_evm' : ActorMethod<
    [EvmWithdrawal, Uint8Array | number[]],
    Result_18
  >,
  /**
   * The ICP owner of the shares (the caller, at its subaccount `from`), refused while halted,
   * while the pool is closed, and for a sanctioned party. Burns the shares `usdc` is worth
   * (rounded up, at most `max_shares`), books `move_fee` to Swapic's ICP fee line, and pays
   * `to` the rest as `token_out` (ckUSDC, or a listed token through its ICPSwap pool, at
   * least `min_out`; below it, all of it as ckUSDC), every ledger fee out of it. Refused when
   * the ICP pocket's free ckUSDC is short. A payout that does not finish in this call
   * answers `Unavailable` with the shares burned, and the canister's timer finishes it.
   */
  'withdraw_icp' : ActorMethod<[WithdrawIcpArgs], Result_19>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];

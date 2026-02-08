module prediction_market::zero_loss_prediction_market {
    use std::string::String;

    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::sui::SUI;

    const E_NOT_ADMIN: u64 = 1;
    const E_ROUND_NOT_FOUND: u64 = 2;
    const E_ROUND_CLOSED: u64 = 3;
    const E_INVALID_SIDE: u64 = 4;
    const E_ZERO_AMOUNT: u64 = 5;
    const E_ALREADY_RESOLVED: u64 = 6;
    const E_TOO_EARLY_TO_SETTLE: u64 = 7;
    const E_NO_PARTICIPANTS: u64 = 8;
    const E_INVALID_MODE: u64 = 9;
    const E_MANUAL_REQUIRES_SIDE: u64 = 10;
    const E_PREDICTION_REQUIRES_SIDE: u64 = 11;
    const E_INVALID_PREDICTION_CONFIG: u64 = 12;
    const E_INSUFFICIENT_PRINCIPAL: u64 = 13;
    const E_INSUFFICIENT_STRATEGY: u64 = 14;
    const E_INSUFFICIENT_STRATEGY_YIELD: u64 = 15;
    const E_INSUFFICIENT_ACCRUED_YIELD: u64 = 16;

    const SIDE_YES: u8 = 1;
    const SIDE_NO: u8 = 2;

    const MODE_RANDOM: u8 = 1;
    const MODE_PREDICTION: u8 = 2;
    const MODE_MANUAL: u8 = 3;
    const MS_PER_YEAR: u64 = 31_536_000_000;

    public struct PredictionMarket has key {
        id: sui::object::UID,
        admin: address,
        next_round_id: u64,
        principal_vault: Balance<SUI>,
        yield_vault: Balance<SUI>,
        strategy_principal_deployed: Balance<SUI>,
        strategy_yield_vault: Balance<SUI>,
        strategy_total_yield_funded: u64,
        strategy_total_yield_allocated: u64,
        strategy_apr_bps: u64,
        strategy_last_accrual_ms: u64,
        strategy_accrued_available: u64,
        strategy_total_accrued: u64,
        rounds: vector<Round>
    }

    public struct Round has store {
        round_id: u64,
        close_timestamp_ms: u64,
        mode: u8,
        manual_side: u8,
        prediction_network: String,
        prediction_token_address: String,
        prediction_target_price_e6: u64,
        prediction_comparator: u8,
        resolved: bool,
        winning_side: u8,
        winner: address,
        total_yes: u64,
        total_no: u64,
        yield_pool: u64,
        yes_users: vector<address>,
        yes_amounts: vector<u64>,
        no_users: vector<address>,
        no_amounts: vector<u64>
    }

    public struct RoundMetadata has key, store {
        id: sui::object::UID,
        round_id: u64,
        question: String,
        close_timestamp_ms: u64
    }

    public struct MarketCreated has copy, drop {
        market_id: sui::object::ID,
        admin: address
    }

    public struct RoundCreated has copy, drop {
        round_id: u64,
        close_timestamp_ms: u64,
        mode: u8,
        manual_side: u8,
        prediction_target_price_e6: u64,
        prediction_comparator: u8,
        metadata_id: sui::object::ID
    }

    public struct BetPlaced has copy, drop {
        round_id: u64,
        user: address,
        side: u8,
        amount: u64
    }

    public struct YieldFunded has copy, drop {
        round_id: u64,
        amount: u64
    }

    public struct RoundSettled has copy, drop {
        round_id: u64,
        mode: u8,
        winning_side: u8,
        winner: address,
        prize_amount: u64
    }

    public struct PrincipalReturned has copy, drop {
        round_id: u64,
        user: address,
        amount: u64
    }

    public struct StrategyPrincipalDeployed has copy, drop {
        amount: u64
    }

    public struct StrategyPrincipalRecalled has copy, drop {
        amount: u64
    }

    public struct StrategyYieldFunded has copy, drop {
        amount: u64,
        by: address
    }

    public struct StrategyYieldAllocated has copy, drop {
        round_id: u64,
        amount: u64
    }

    public struct StrategyYieldAccrued has copy, drop {
        elapsed_ms: u64,
        deployed_principal: u64,
        apr_bps: u64,
        accrued_amount: u64,
        accrued_available: u64
    }

    public struct StrategyAprUpdated has copy, drop {
        apr_bps: u64
    }

    fun init(ctx: &mut sui::tx_context::TxContext) {
        let admin = ctx.sender();
        let market = PredictionMarket {
            id: sui::object::new(ctx),
            admin,
            next_round_id: 0,
            principal_vault: balance::zero<SUI>(),
            yield_vault: balance::zero<SUI>(),
            strategy_principal_deployed: balance::zero<SUI>(),
            strategy_yield_vault: balance::zero<SUI>(),
            strategy_total_yield_funded: 0,
            strategy_total_yield_allocated: 0,
            strategy_apr_bps: 350,
            strategy_last_accrual_ms: 0,
            strategy_accrued_available: 0,
            strategy_total_accrued: 0,
            rounds: vector::empty<Round>()
        };

        event::emit(MarketCreated {
            market_id: sui::object::id(&market),
            admin
        });

        sui::transfer::share_object(market);
    }

    public entry fun create_round(
        market: &mut PredictionMarket,
        question: String,
        close_timestamp_ms: u64,
        mode: u8,
        manual_side: u8,
        prediction_network: String,
        prediction_token_address: String,
        prediction_target_price_e6: u64,
        prediction_comparator: u8,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_admin(market, ctx);
        assert_mode(mode);

        let now_ms = clock::timestamp_ms(clock);
        assert!(close_timestamp_ms > now_ms, E_ROUND_CLOSED);

        if (mode == MODE_MANUAL) {
            assert_valid_side(manual_side);
            assert!(prediction_target_price_e6 == 0 && prediction_comparator == 0, E_INVALID_PREDICTION_CONFIG);
        } else if (mode == MODE_PREDICTION) {
            assert!(manual_side == 0, E_MANUAL_REQUIRES_SIDE);
            assert!(prediction_target_price_e6 > 0, E_INVALID_PREDICTION_CONFIG);
            assert!(prediction_comparator == 1 || prediction_comparator == 2, E_INVALID_PREDICTION_CONFIG);
        } else {
            assert!(manual_side == 0, E_MANUAL_REQUIRES_SIDE);
            assert!(prediction_target_price_e6 == 0 && prediction_comparator == 0, E_INVALID_PREDICTION_CONFIG);
        };

        let round_id = market.next_round_id;
        market.next_round_id = round_id + 1;

        let round = Round {
            round_id,
            close_timestamp_ms,
            mode,
            manual_side,
            prediction_network,
            prediction_token_address,
            prediction_target_price_e6,
            prediction_comparator,
            resolved: false,
            winning_side: 0,
            winner: @0x0,
            total_yes: 0,
            total_no: 0,
            yield_pool: 0,
            yes_users: vector::empty<address>(),
            yes_amounts: vector::empty<u64>(),
            no_users: vector::empty<address>(),
            no_amounts: vector::empty<u64>()
        };

        vector::push_back(&mut market.rounds, round);

        let metadata = RoundMetadata {
            id: sui::object::new(ctx),
            round_id,
            question,
            close_timestamp_ms
        };
        let metadata_id = sui::object::id(&metadata);
        sui::transfer::share_object(metadata);

        event::emit(RoundCreated {
            round_id,
            close_timestamp_ms,
            mode,
            manual_side,
            prediction_target_price_e6,
            prediction_comparator,
            metadata_id
        });
    }

    public entry fun place_bet(
        market: &mut PredictionMarket,
        round_id: u64,
        side: u8,
        stake: Coin<SUI>,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_valid_side(side);
        let amount = coin::value(&stake);
        assert!(amount > 0, E_ZERO_AMOUNT);

        let now_ms = clock::timestamp_ms(clock);
        let round_read = borrow_round(market, round_id);
        assert!(!round_read.resolved, E_ALREADY_RESOLVED);
        assert!(now_ms < round_read.close_timestamp_ms, E_ROUND_CLOSED);

        let user = ctx.sender();
        let stake_balance = coin::into_balance(stake);
        balance::join(&mut market.principal_vault, stake_balance);

        let round = borrow_round_mut(market, round_id);
        if (side == SIDE_YES) {
            add_stake(&mut round.yes_users, &mut round.yes_amounts, user, amount);
            round.total_yes = round.total_yes + amount;
        } else {
            add_stake(&mut round.no_users, &mut round.no_amounts, user, amount);
            round.total_no = round.total_no + amount;
        };

        event::emit(BetPlaced {
            round_id,
            user,
            side,
            amount
        });
    }

    public entry fun fund_yield(
        market: &mut PredictionMarket,
        round_id: u64,
        contribution: Coin<SUI>,
    ) {
        let amount = coin::value(&contribution);
        assert!(amount > 0, E_ZERO_AMOUNT);

        let contribution_balance = coin::into_balance(contribution);
        balance::join(&mut market.yield_vault, contribution_balance);

        let round = borrow_round_mut(market, round_id);
        round.yield_pool = round.yield_pool + amount;

        event::emit(YieldFunded {
            round_id,
            amount
        });
    }

    public entry fun set_strategy_apr_bps(
        market: &mut PredictionMarket,
        apr_bps: u64,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_admin(market, ctx);
        market.strategy_apr_bps = apr_bps;
        event::emit(StrategyAprUpdated { apr_bps });
    }

    // Simulates deploying principal into an external strategy (SuiLend adapter path).
    public entry fun deploy_principal_to_strategy(
        market: &mut PredictionMarket,
        amount: u64,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_admin(market, ctx);
        accrue_strategy_yield_internal(market, clock);
        assert!(amount > 0, E_ZERO_AMOUNT);
        let available = balance::value(&market.principal_vault);
        assert!(available >= amount, E_INSUFFICIENT_PRINCIPAL);

        let deployed = balance::split(&mut market.principal_vault, amount);
        balance::join(&mut market.strategy_principal_deployed, deployed);
        event::emit(StrategyPrincipalDeployed { amount });
    }

    // Simulates recalling principal from strategy into the market vault.
    public entry fun recall_principal_from_strategy(
        market: &mut PredictionMarket,
        amount: u64,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_admin(market, ctx);
        accrue_strategy_yield_internal(market, clock);
        assert!(amount > 0, E_ZERO_AMOUNT);
        let deployed = balance::value(&market.strategy_principal_deployed);
        assert!(deployed >= amount, E_INSUFFICIENT_STRATEGY);

        let recalled = balance::split(&mut market.strategy_principal_deployed, amount);
        balance::join(&mut market.principal_vault, recalled);
        event::emit(StrategyPrincipalRecalled { amount });
    }

    // Funds strategy yield reserve that can later be allocated into round prize pools.
    public entry fun fund_strategy_yield(
        market: &mut PredictionMarket,
        contribution: Coin<SUI>,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let amount = coin::value(&contribution);
        assert!(amount > 0, E_ZERO_AMOUNT);
        let contribution_balance = coin::into_balance(contribution);
        balance::join(&mut market.strategy_yield_vault, contribution_balance);
        market.strategy_total_yield_funded = market.strategy_total_yield_funded + amount;

        event::emit(StrategyYieldFunded {
            amount,
            by: ctx.sender()
        });
    }

    public entry fun accrue_strategy_yield(
        market: &mut PredictionMarket,
        clock: &Clock,
    ) {
        accrue_strategy_yield_internal(market, clock);
    }

    // Routes accrued strategy yield into a specific round's prize pool.
    public entry fun allocate_strategy_yield_to_round(
        market: &mut PredictionMarket,
        round_id: u64,
        amount: u64,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_admin(market, ctx);
        accrue_strategy_yield_internal(market, clock);
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(market.strategy_accrued_available >= amount, E_INSUFFICIENT_ACCRUED_YIELD);
        let available = balance::value(&market.strategy_yield_vault);
        assert!(available >= amount, E_INSUFFICIENT_STRATEGY_YIELD);

        let routed = balance::split(&mut market.strategy_yield_vault, amount);
        balance::join(&mut market.yield_vault, routed);
        market.strategy_accrued_available = market.strategy_accrued_available - amount;
        market.strategy_total_yield_allocated = market.strategy_total_yield_allocated + amount;

        let round = borrow_round_mut(market, round_id);
        round.yield_pool = round.yield_pool + amount;

        event::emit(YieldFunded { round_id, amount });
        event::emit(StrategyYieldAllocated { round_id, amount });
    }

    // Finalizes the round: picks winning side/winner and returns all principals automatically.
    // prediction_outcome_side is used only for MODE_PREDICTION (must be YES/NO).
    public entry fun settle_round(
        market: &mut PredictionMarket,
        round_id: u64,
        prediction_outcome_side: u8,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let now_ms = clock::timestamp_ms(clock);

        let winner;
        let winning_side;
        let payout;
        let mode;

        let mut refund_users = vector::empty<address>();
        let mut refund_amounts = vector::empty<u64>();

        {
            let round = borrow_round_mut(market, round_id);
            assert!(!round.resolved, E_ALREADY_RESOLVED);
            assert!(now_ms >= round.close_timestamp_ms, E_TOO_EARLY_TO_SETTLE);

            let total_pool = round.total_yes + round.total_no;
            assert!(total_pool > 0, E_NO_PARTICIPANTS);

            mode = round.mode;
            if (mode == MODE_RANDOM) {
                let r = pseudo_random_u64(now_ms, round.round_id, total_pool);
                winning_side = if ((r % 2) == 0) SIDE_YES else SIDE_NO;
            } else if (mode == MODE_MANUAL) {
                winning_side = round.manual_side;
            } else {
                assert!(prediction_outcome_side == SIDE_YES || prediction_outcome_side == SIDE_NO, E_PREDICTION_REQUIRES_SIDE);
                winning_side = prediction_outcome_side;
            };

            let (winner_users, winner_amounts, winner_total) = if (winning_side == SIDE_YES) {
                (&round.yes_users, &round.yes_amounts, round.total_yes)
            } else {
                (&round.no_users, &round.no_amounts, round.total_no)
            };

            // If no one matched outcome, fallback to all participants to keep flow live.
            if (winner_total > 0) {
                let rnd = pseudo_random_u64(now_ms, round.round_id + 17, winner_total);
                winner = select_weighted_winner(winner_users, winner_amounts, winner_total, rnd);
            } else {
                let mut all_users = vector::empty<address>();
                let mut all_amounts = vector::empty<u64>();
                append_non_zero(&round.yes_users, &round.yes_amounts, &mut all_users, &mut all_amounts);
                append_non_zero(&round.no_users, &round.no_amounts, &mut all_users, &mut all_amounts);
                let rnd = pseudo_random_u64(now_ms, round.round_id + 23, total_pool);
                winner = select_weighted_winner(&all_users, &all_amounts, total_pool, rnd);
            };

            payout = round.yield_pool;
            round.yield_pool = 0;

            collect_refunds_and_zero(&round.yes_users, &mut round.yes_amounts, &mut refund_users, &mut refund_amounts);
            collect_refunds_and_zero(&round.no_users, &mut round.no_amounts, &mut refund_users, &mut refund_amounts);

            round.total_yes = 0;
            round.total_no = 0;
            round.resolved = true;
            round.winning_side = winning_side;
            round.winner = winner;
        };

        let needed_principal = sum_amounts(&refund_amounts);
        if (needed_principal > 0) {
            let available_principal = balance::value(&market.principal_vault);
            if (available_principal < needed_principal) {
                let shortfall = needed_principal - available_principal;
                let deployed = balance::value(&market.strategy_principal_deployed);
                assert!(deployed >= shortfall, E_INSUFFICIENT_STRATEGY);
                let recalled = balance::split(&mut market.strategy_principal_deployed, shortfall);
                balance::join(&mut market.principal_vault, recalled);
            };
        };

        let refunds_len = vector::length(&refund_users);
        let mut i = 0;
        while (i < refunds_len) {
            let user = *vector::borrow(&refund_users, i);
            let amount = *vector::borrow(&refund_amounts, i);
            if (amount > 0) {
                let refund_balance = balance::split(&mut market.principal_vault, amount);
                sui::transfer::public_transfer(coin::from_balance(refund_balance, ctx), user);
                event::emit(PrincipalReturned {
                    round_id,
                    user,
                    amount
                });
            };
            i = i + 1;
        };

        if (payout > 0) {
            let prize_balance = balance::split(&mut market.yield_vault, payout);
            sui::transfer::public_transfer(coin::from_balance(prize_balance, ctx), winner);
        };

        event::emit(RoundSettled {
            round_id,
            mode,
            winning_side,
            winner,
            prize_amount: payout
        });
    }

    public fun market_admin(market: &PredictionMarket): address {
        market.admin
    }

    public fun round_count(market: &PredictionMarket): u64 {
        vector::length(&market.rounds)
    }

    public fun get_round_meta(market: &PredictionMarket, round_id: u64): (u64, u8, bool, u8, address, u64, u64, u64, u64, u8) {
        let round = borrow_round(market, round_id);
        (
            round.close_timestamp_ms,
            round.mode,
            round.resolved,
            round.winning_side,
            round.winner,
            round.total_yes,
            round.total_no,
            round.yield_pool,
            round.prediction_target_price_e6,
            round.prediction_comparator
        )
    }

    public fun get_strategy_meta(market: &PredictionMarket): (u64, u64, u64, u64, u64, u64) {
        (
            balance::value(&market.principal_vault),
            balance::value(&market.strategy_principal_deployed),
            balance::value(&market.strategy_yield_vault),
            balance::value(&market.yield_vault),
            market.strategy_total_yield_funded,
            market.strategy_total_yield_allocated
        )
    }

    public fun get_strategy_meta_v2(market: &PredictionMarket): (u64, u64, u64, u64, u64, u64, u64, u64, u64, u64) {
        (
            balance::value(&market.principal_vault),
            balance::value(&market.strategy_principal_deployed),
            balance::value(&market.strategy_yield_vault),
            balance::value(&market.yield_vault),
            market.strategy_total_yield_funded,
            market.strategy_total_yield_allocated,
            market.strategy_apr_bps,
            market.strategy_last_accrual_ms,
            market.strategy_accrued_available,
            market.strategy_total_accrued
        )
    }

    fun assert_admin(market: &PredictionMarket, ctx: &sui::tx_context::TxContext) {
        assert!(market.admin == ctx.sender(), E_NOT_ADMIN);
    }

    fun assert_mode(mode: u8) {
        assert!(mode == MODE_RANDOM || mode == MODE_PREDICTION || mode == MODE_MANUAL, E_INVALID_MODE);
    }

    fun assert_valid_side(side: u8) {
        assert!(side == SIDE_YES || side == SIDE_NO, E_INVALID_SIDE);
    }

    fun pseudo_random_u64(now_ms: u64, a: u64, b: u64): u64 {
        let mixed =
            (now_ms as u128) * 6364136223846793005 +
            (a as u128) * 1442695040888963407 +
            (b as u128) * 22695477;
        (mixed % 18446744073709551615) as u64
    }

    fun select_weighted_winner(
        users: &vector<address>,
        amounts: &vector<u64>,
        total: u64,
        randomness: u64,
    ): address {
        let random_point = randomness % total;
        let mut sum = 0;
        let len = vector::length(users);
        let mut i = 0;
        while (i < len) {
            let amt = *vector::borrow(amounts, i);
            sum = sum + amt;
            if (random_point < sum) {
                return *vector::borrow(users, i)
            };
            i = i + 1;
        };

        *vector::borrow(users, len - 1)
    }

    fun append_non_zero(
        users: &vector<address>,
        amounts: &vector<u64>,
        out_users: &mut vector<address>,
        out_amounts: &mut vector<u64>,
    ) {
        let len = vector::length(users);
        let mut i = 0;
        while (i < len) {
            let amt = *vector::borrow(amounts, i);
            if (amt > 0) {
                vector::push_back(out_users, *vector::borrow(users, i));
                vector::push_back(out_amounts, amt);
            };
            i = i + 1;
        };
    }

    fun collect_refunds_and_zero(
        users: &vector<address>,
        amounts: &mut vector<u64>,
        out_users: &mut vector<address>,
        out_amounts: &mut vector<u64>,
    ) {
        let len = vector::length(users);
        let mut i = 0;
        while (i < len) {
            let amt_ref = vector::borrow_mut(amounts, i);
            let amt = *amt_ref;
            if (amt > 0) {
                vector::push_back(out_users, *vector::borrow(users, i));
                vector::push_back(out_amounts, amt);
                *amt_ref = 0;
            };
            i = i + 1;
        };
    }

    fun sum_amounts(amounts: &vector<u64>): u64 {
        let len = vector::length(amounts);
        let mut total = 0;
        let mut i = 0;
        while (i < len) {
            total = total + *vector::borrow(amounts, i);
            i = i + 1;
        };
        total
    }

    fun accrue_strategy_yield_internal(
        market: &mut PredictionMarket,
        clock: &Clock,
    ) {
        let now_ms = clock::timestamp_ms(clock);
        let last = market.strategy_last_accrual_ms;
        if (last == 0) {
            market.strategy_last_accrual_ms = now_ms;
            event::emit(StrategyYieldAccrued {
                elapsed_ms: 0,
                deployed_principal: balance::value(&market.strategy_principal_deployed),
                apr_bps: market.strategy_apr_bps,
                accrued_amount: 0,
                accrued_available: market.strategy_accrued_available
            });
            return
        };
        if (now_ms <= last) {
            return
        };

        let elapsed_ms = now_ms - last;
        let deployed_principal = balance::value(&market.strategy_principal_deployed);
        if (deployed_principal == 0 || market.strategy_apr_bps == 0) {
            market.strategy_last_accrual_ms = now_ms;
            event::emit(StrategyYieldAccrued {
                elapsed_ms,
                deployed_principal,
                apr_bps: market.strategy_apr_bps,
                accrued_amount: 0,
                accrued_available: market.strategy_accrued_available
            });
            return
        };

        let accrued_u128 =
            (deployed_principal as u128) *
            (market.strategy_apr_bps as u128) *
            (elapsed_ms as u128) /
            10_000u128 /
            (MS_PER_YEAR as u128);
        let accrued = accrued_u128 as u64;
        if (accrued > 0) {
            market.strategy_accrued_available = market.strategy_accrued_available + accrued;
            market.strategy_total_accrued = market.strategy_total_accrued + accrued;
        };
        market.strategy_last_accrual_ms = now_ms;

        event::emit(StrategyYieldAccrued {
            elapsed_ms,
            deployed_principal,
            apr_bps: market.strategy_apr_bps,
            accrued_amount: accrued,
            accrued_available: market.strategy_accrued_available
        });
    }

    fun borrow_round_mut(market: &mut PredictionMarket, round_id: u64): &mut Round {
        let len = vector::length(&market.rounds);
        let mut i = 0;
        while (i < len) {
            let round_ref = vector::borrow_mut(&mut market.rounds, i);
            if (round_ref.round_id == round_id) {
                return round_ref
            };
            i = i + 1;
        };

        abort E_ROUND_NOT_FOUND
    }

    fun borrow_round(market: &PredictionMarket, round_id: u64): &Round {
        let len = vector::length(&market.rounds);
        let mut i = 0;
        while (i < len) {
            let round_ref = vector::borrow(&market.rounds, i);
            if (round_ref.round_id == round_id) {
                return round_ref
            };
            i = i + 1;
        };

        abort E_ROUND_NOT_FOUND
    }

    fun add_stake(users: &mut vector<address>, amounts: &mut vector<u64>, user: address, amount: u64) {
        let len = vector::length(users);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(users, i) == user) {
                let amount_ref = vector::borrow_mut(amounts, i);
                *amount_ref = *amount_ref + amount;
                return
            };
            i = i + 1;
        };

        vector::push_back(users, user);
        vector::push_back(amounts, amount);
    }
}

module prediction_market::mock_yield_engine {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::sui::SUI;

    use prediction_market::zero_loss_prediction_market::{Self, PredictionMarket};

    const E_NOT_ADMIN: u64 = 1;
    const E_ZERO_AMOUNT: u64 = 2;
    const E_BPS_TOO_HIGH: u64 = 3;

    public struct MockYieldEngine has key {
        id: sui::object::UID,
        admin: address,
        reserve: Balance<SUI>
    }

    public struct YieldEngineCreated has copy, drop {
        engine_id: sui::object::ID,
        admin: address
    }

    public struct ReserveDeposited has copy, drop {
        amount: u64
    }

    public struct MockYieldDistributed has copy, drop {
        round_id: u64,
        amount: u64,
        basis_points: u64
    }

    fun init(ctx: &mut sui::tx_context::TxContext) {
        let admin = ctx.sender();
        let engine = MockYieldEngine {
            id: sui::object::new(ctx),
            admin,
            reserve: balance::zero<SUI>()
        };

        event::emit(YieldEngineCreated {
            engine_id: sui::object::id(&engine),
            admin
        });

        sui::transfer::share_object(engine);
    }

    public entry fun deposit_reserve(engine: &mut MockYieldEngine, coins: Coin<SUI>) {
        let amount = coin::value(&coins);
        assert!(amount > 0, E_ZERO_AMOUNT);

        balance::join(&mut engine.reserve, coin::into_balance(coins));
        event::emit(ReserveDeposited { amount });
    }

    // Mock yield simulator: emits fake yield from reserve into the market's yield vault.
    public entry fun distribute_mock_yield(
        engine: &mut MockYieldEngine,
        market: &mut PredictionMarket,
        round_id: u64,
        basis_points: u64,
        max_amount: u64,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        assert_admin(engine, ctx);
        assert!(basis_points <= 10_000, E_BPS_TOO_HIGH);

        let reserve_value = balance::value(&engine.reserve);
        let computed = ((reserve_value as u128) * (basis_points as u128) / 10_000) as u64;
        let amount = if (max_amount > 0 && computed > max_amount) max_amount else computed;
        assert!(amount > 0, E_ZERO_AMOUNT);

        let out = balance::split(&mut engine.reserve, amount);
        zero_loss_prediction_market::fund_yield(market, round_id, coin::from_balance(out, ctx));

        event::emit(MockYieldDistributed {
            round_id,
            amount,
            basis_points
        });
    }

    public fun reserve_value(engine: &MockYieldEngine): u64 {
        balance::value(&engine.reserve)
    }

    fun assert_admin(engine: &MockYieldEngine, ctx: &sui::tx_context::TxContext) {
        assert!(engine.admin == ctx.sender(), E_NOT_ADMIN);
    }
}

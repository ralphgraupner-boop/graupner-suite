"""Regression: Quote/Order/Invoice muessen alte String-Werte aus der DB tolerant parsen.
Hintergrund: GET /api/quotes brach auf Live, weil Geldfelder als "" oder "123,45" gespeichert waren.
Fix: CoercedFloat / OptCoercedFloat in models.py.
"""
from models import Quote, Order, Invoice


def test_quote_parst_kaputte_werte():
    q = Quote(**{
        "customer_id": "x", "discount": "", "vat_rate": "19,00",
        "subtotal_net": "1.234,50", "vat_amount": "234,56",
        "total_gross": "1.469,06", "lohnanteil_custom": "",
    })
    assert q.discount == 0.0
    assert q.vat_rate == 19.0
    assert q.subtotal_net == 1234.5
    assert q.total_gross == 1469.06
    assert q.lohnanteil_custom is None


def test_order_parst_kaputte_werte():
    o = Order(**{"customer_id": "x", "discount": "5,5", "total_gross": "", "lohnanteil_custom": "750,00"})
    assert o.discount == 5.5
    assert o.total_gross == 0.0
    assert o.lohnanteil_custom == 750.0


def test_invoice_parst_kaputte_werte():
    i = Invoice(**{
        "customer_id": "x", "deposit_amount": "200,00", "final_amount": "",
        "dunning_fee": "", "lohnanteil_custom": "abc",
    })
    assert i.deposit_amount == 200.0
    assert i.final_amount == 0.0
    assert i.dunning_fee == 0.0
    assert i.lohnanteil_custom is None  # unparsbar -> None


def test_gueltige_zahlen_bleiben_unveraendert():
    q = Quote(**{"customer_id": "x", "discount": 10, "vat_rate": 19.0, "total_gross": 500.25})
    assert q.discount == 10.0
    assert q.vat_rate == 19.0
    assert q.total_gross == 500.25

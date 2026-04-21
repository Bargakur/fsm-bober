import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/order.dart';
import '../services/api_service.dart';
import '../widgets/order_card.dart';

class DayScreen extends StatefulWidget {
  final int technicianId;
  final String technicianName;

  const DayScreen({
    super.key,
    required this.technicianId,
    required this.technicianName,
  });

  @override
  State<DayScreen> createState() => _DayScreenState();
}

class _DayScreenState extends State<DayScreen> {
  late DateTime _selectedDate;
  List<Order> _orders = [];
  bool _loading = false;
  int? _expandedOrderId;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _loadOrders();
  }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_selectedDate);

  bool get _isToday =>
      DateFormat('yyyy-MM-dd').format(_selectedDate) ==
      DateFormat('yyyy-MM-dd').format(DateTime.now());

  Future<void> _loadOrders() async {
    setState(() => _loading = true);
    try {
      final orders = await ApiService.getTechnicianOrders(
        widget.technicianId,
        _dateStr,
      );
      setState(() {
        _orders = orders;
        _expandedOrderId = _findNextOrderId(orders);
      });
    } catch (e) {
      setState(() => _orders = []);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Błąd: $e')),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  int? _findNextOrderId(List<Order> orders) {
    final now = TimeOfDay.now();
    final nowStr =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:00';

    if (_isToday) {
      // Pierwsze nieukończone zlecenie od teraz
      final next = orders.where((o) => !o.isCompleted && o.scheduledStart.compareTo(nowStr) >= 0).toList();
      if (next.isNotEmpty) return next.first.id;
    }
    // Fallback: pierwsze nieukończone
    final pending = orders.where((o) => !o.isCompleted).toList();
    return pending.isNotEmpty ? pending.first.id : null;
  }

  void _changeDay(int delta) {
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: delta));
    });
    _loadOrders();
  }

  Future<void> _handleComplete(Order order) async {
    final result = await showModalBottomSheet<Map<String, String?>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CompleteSheet(order: order),
    );

    if (result != null) {
      try {
        await ApiService.completeOrder(
          order.id,
          paymentOverride: result['paymentOverride'],
          technicianNotes: result['technicianNotes'],
        );
        _loadOrders();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Błąd: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dayName = DateFormat('EEEE', 'pl_PL').format(_selectedDate);
    final dayDate = DateFormat('d MMMM', 'pl_PL').format(_selectedDate);
    final completedCount = _orders.where((o) => o.isCompleted).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F6F3),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              color: const Color(0xFF1A1A1E),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                children: [
                  // Technik
                  Row(
                    children: [
                      const Icon(Icons.person_outline, color: Colors.white70, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        widget.technicianName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: Icon(
                          Icons.refresh,
                          color: Colors.white70,
                          size: 22,
                        ),
                        onPressed: _loadOrders,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Nawigacja dnia
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.chevron_left, color: Colors.white, size: 28),
                        onPressed: () => _changeDay(-1),
                      ),
                      Column(
                        children: [
                          if (_isToday)
                            Container(
                              margin: const EdgeInsets.only(bottom: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFC8712E),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text(
                                'Dziś',
                                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                          Text(
                            '$dayName, $dayDate',
                            style: const TextStyle(color: Colors.white, fontSize: 16),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.chevron_right, color: Colors.white, size: 28),
                        onPressed: () => _changeDay(1),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Lista zleceń
            Expanded(
              child: _loading && _orders.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _orders.isEmpty
                      ? Center(
                          child: Text(
                            'Brak zleceń na ${_isToday ? "dziś" : dayDate}',
                            style: TextStyle(fontSize: 16, color: Colors.grey.shade500),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _loadOrders,
                          child: ListView.builder(
                            padding: const EdgeInsets.only(top: 10, bottom: 20),
                            itemCount: _orders.length + 1, // +1 for summary
                            itemBuilder: (context, index) {
                              if (index == _orders.length) {
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  child: Center(
                                    child: Text(
                                      '$completedCount / ${_orders.length} zakończonych',
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.grey.shade500,
                                      ),
                                    ),
                                  ),
                                );
                              }

                              final order = _orders[index];
                              final previousOrder = index > 0 ? _orders[index - 1] : null;
                              return OrderCard(
                                order: order,
                                previousOrder: previousOrder,
                                isExpanded: _expandedOrderId == order.id,
                                isNext: _expandedOrderId == order.id && !order.isCompleted,
                                onTap: () {
                                  setState(() {
                                    _expandedOrderId =
                                        _expandedOrderId == order.id ? null : order.id;
                                  });
                                },
                                onCompleted: () => _handleComplete(order),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---- Bottom Sheet ----

class _CompleteSheet extends StatefulWidget {
  final Order order;
  const _CompleteSheet({required this.order});

  @override
  State<_CompleteSheet> createState() => _CompleteSheetState();
}

class _CompleteSheetState extends State<_CompleteSheet> {
  String? _paymentOverride;
  final _notesController = TextEditingController();

  static const _paymentLabels = {
    'transfer': 'Przelew',
    'cash': 'Gotówka',
    'card': 'Karta',
  };

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentPayment = _paymentLabels[widget.order.paymentMethod] ?? 'Przelew';

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20, 20, 20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Zamknij zlecenie',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),

          Text('Forma płatności (jeśli inna niż $currentPayment)',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String?>(
            value: _paymentOverride,
            decoration: InputDecoration(
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: const [
              DropdownMenuItem(value: null, child: Text('Bez zmian')),
              DropdownMenuItem(value: 'cash', child: Text('Gotówka')),
              DropdownMenuItem(value: 'card', child: Text('Karta')),
              DropdownMenuItem(value: 'transfer', child: Text('Przelew')),
            ],
            onChanged: (v) => setState(() => _paymentOverride = v),
          ),
          const SizedBox(height: 16),

          Text('Uwagi (opcjonalne)',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600)),
          const SizedBox(height: 6),
          TextField(
            controller: _notesController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Dodatkowe uwagi...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 20),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Anuluj'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context, {
                      'paymentOverride': _paymentOverride,
                      'technicianNotes':
                          _notesController.text.isEmpty ? null : _notesController.text,
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Potwierdź zakończenie'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

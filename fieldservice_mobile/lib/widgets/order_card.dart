import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/order.dart';

class OrderCard extends StatelessWidget {
  final Order order;
  final Order? previousOrder; // poprzednie zlecenie — do nawigacji trasy
  final bool isExpanded;
  final bool isNext;
  final VoidCallback onTap;
  final VoidCallback onCompleted;

  const OrderCard({
    super.key,
    required this.order,
    this.previousOrder,
    required this.isExpanded,
    required this.isNext,
    required this.onTap,
    required this.onCompleted,
  });

  static const _paymentLabels = {
    'transfer': 'Przelew',
    'cash': 'Gotówka',
    'card': 'Karta',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isNext ? const Color(0xFFC8712E) : Colors.grey.shade200,
          width: isNext ? 2.0 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Opacity(
        opacity: order.isCompleted ? 0.55 : 1.0,
        child: Column(
          children: [
            // Nagłówek — zawsze widoczny
            _buildHeader(context),
            // Rozwinięta treść
            if (isExpanded) _buildBody(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Czas + badge
            Row(
              children: [
                Icon(Icons.schedule, size: 16, color: Colors.grey.shade500),
                const SizedBox(width: 6),
                Text(
                  '${order.startTimeShort} – ${order.endTimeShort}',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
                const Spacer(),
                if (isNext && !order.isCompleted)
                  _badge('Następne', const Color(0xFFC8712E)),
                if (order.isInProgress)
                  _badge('W trakcie', Colors.orange.shade700),
                if (order.isCompleted)
                  const Icon(Icons.check_circle, color: Colors.green, size: 22),
                if (!order.isCompleted)
                  Icon(
                    isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: Colors.grey.shade400,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            // Nazwa zabiegu
            Text(
              order.treatment?.name ?? 'Zabieg',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 2),
            // Klient
            Text(
              order.customerName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Adres — link do map
          _linkRow(
            Icons.location_on_outlined,
            order.address,
            () => _openMaps(order.address),
            Colors.blue.shade700,
          ),
          const SizedBox(height: 10),

          // Telefon klienta
          _linkRow(
            Icons.phone_outlined,
            order.customerPhone,
            () => _call(order.customerPhone),
            Colors.blue.shade700,
          ),

          // Telefon kontaktowy
          if (order.contactPhone != null && order.contactPhone!.isNotEmpty) ...[
            const SizedBox(height: 10),
            _linkRow(
              Icons.phone_outlined,
              '${order.contactPhone} (kontakt na miejscu)',
              () => _call(order.contactPhone!),
              Colors.blue.shade700,
            ),
          ],

          // Zakres
          if (order.scope != null && order.scope!.isNotEmpty) ...[
            const SizedBox(height: 10),
            _infoRow(Icons.description_outlined, order.scope!),
          ],

          // Płatność
          const SizedBox(height: 10),
          _infoRow(
            Icons.credit_card_outlined,
            'Płatność: ${_paymentLabels[order.paymentMethod] ?? order.paymentMethod ?? 'Brak'}',
          ),

          // Cena
          const SizedBox(height: 10),
          Text(
            '${order.price.toStringAsFixed(0)} zł',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),

          // Uwagi handlowca
          if (order.notes != null && order.notes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.chat_bubble_outline, size: 16, color: Colors.amber.shade800),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(order.notes!, style: const TextStyle(fontSize: 14)),
                  ),
                ],
              ),
            ),
          ],

          // Przycisk zakończenia
          if (!order.isCompleted) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _showCompleteDialog(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green.shade600,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text(
                  'Zakończ zabieg',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey.shade500),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
      ],
    );
  }

  Widget _linkRow(IconData icon, String text, VoidCallback onTap, Color color) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 14, color: color)),
          ),
        ],
      ),
    );
  }

  void _openMaps(String address) async {
    final Uri url;

    // Jeśli mamy poprzednie zlecenie — nawiguj trasę z jego lokalizacji
    if (previousOrder != null && previousOrder!.lat != 0 && previousOrder!.lng != 0 && order.lat != 0 && order.lng != 0) {
      url = Uri.parse(
        'https://www.google.com/maps/dir/?api=1'
        '&origin=${previousOrder!.lat},${previousOrder!.lng}'
        '&destination=${order.lat},${order.lng}'
        '&travelmode=driving',
      );
    } else if (order.lat != 0 && order.lng != 0) {
      // Brak poprzedniego — pokaż pinezkę z koordynatami
      url = Uri.parse('https://www.google.com/maps?q=${order.lat},${order.lng}');
    } else {
      // Fallback na adres tekstowy
      url = Uri.parse('https://maps.google.com/?q=${Uri.encodeComponent(address)}');
    }

    if (await canLaunchUrl(url)) await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  void _call(String phone) async {
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) await launchUrl(url);
  }

  void _showCompleteDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CompleteOrderSheet(
        order: order,
        onCompleted: onCompleted,
      ),
    );
  }
}

// ---- Bottom sheet do zamykania zlecenia ----

class _CompleteOrderSheet extends StatefulWidget {
  final Order order;
  final VoidCallback onCompleted;

  const _CompleteOrderSheet({required this.order, required this.onCompleted});

  @override
  State<_CompleteOrderSheet> createState() => _CompleteOrderSheetState();
}

class _CompleteOrderSheetState extends State<_CompleteOrderSheet> {
  String? _paymentOverride;
  final _notesController = TextEditingController();
  bool _submitting = false;

  static const _paymentOptions = [
    (value: null, label: 'Bez zmian'),
    (value: 'cash', label: 'Gotówka'),
    (value: 'card', label: 'Karta'),
    (value: 'transfer', label: 'Przelew'),
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      // Import tutaj nie jest potrzebny — wywołanie przez serwis w ekranie głównym
      // API call jest w DayScreen
      Navigator.of(context).pop({
        'paymentOverride': _paymentOverride,
        'technicianNotes': _notesController.text.isEmpty ? null : _notesController.text,
      });
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Błąd: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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

          // Forma płatności
          const Text('Forma płatności (jeśli inna)', style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String?>(
            value: _paymentOverride,
            decoration: InputDecoration(
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: _paymentOptions.map((o) => DropdownMenuItem(
              value: o.value,
              child: Text(o.label),
            )).toList(),
            onChanged: (v) => setState(() => _paymentOverride = v),
          ),
          const SizedBox(height: 16),

          // Uwagi technika
          const Text('Uwagi (opcjonalne)', style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 6),
          TextField(
            controller: _notesController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Dodatkowe uwagi do zlecenia...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 20),

          // TODO: upload zdjęcia protokołu

          // Przyciski
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
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(_submitting ? 'Zapisuję...' : 'Potwierdź'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

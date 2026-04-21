import 'treatment.dart';

class Order {
  final int id;
  final String customerName;
  final String customerPhone;
  final String? contactPhone;
  final String address;
  final double lat;
  final double lng;
  final int treatmentId;
  final String? scope;
  final int? technicianId;
  final String scheduledDate; // "2026-04-15"
  final String scheduledStart; // "09:00:00"
  final String scheduledEnd; // "10:00:00"
  final String status; // draft, assigned, in_progress, completed
  final String? paymentMethod;
  final double price;
  final String? notes;
  final Treatment? treatment;

  Order({
    required this.id,
    required this.customerName,
    required this.customerPhone,
    this.contactPhone,
    required this.address,
    required this.lat,
    required this.lng,
    required this.treatmentId,
    this.scope,
    this.technicianId,
    required this.scheduledDate,
    required this.scheduledStart,
    required this.scheduledEnd,
    required this.status,
    this.paymentMethod,
    required this.price,
    this.notes,
    this.treatment,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'],
      customerName: json['customerName'] ?? '',
      customerPhone: json['customerPhone'] ?? '',
      contactPhone: json['contactPhone'],
      address: json['address'] ?? '',
      lat: (json['lat'] ?? 0).toDouble(),
      lng: (json['lng'] ?? 0).toDouble(),
      treatmentId: json['treatmentId'] ?? 0,
      scope: json['scope'],
      technicianId: json['technicianId'],
      scheduledDate: json['scheduledDate'] ?? '',
      scheduledStart: json['scheduledStart'] ?? '',
      scheduledEnd: json['scheduledEnd'] ?? '',
      status: json['status'] ?? 'draft',
      paymentMethod: json['paymentMethod'],
      price: (json['price'] ?? 0).toDouble(),
      notes: json['notes'],
      treatment: json['treatment'] != null
          ? Treatment.fromJson(json['treatment'])
          : null,
    );
  }

  String get startTimeShort => scheduledStart.substring(0, 5);
  String get endTimeShort => scheduledEnd.substring(0, 5);
  bool get isCompleted => status == 'completed';
  bool get isInProgress => status == 'in_progress';
}

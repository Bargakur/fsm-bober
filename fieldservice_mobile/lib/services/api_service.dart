import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/order.dart';
import '../models/technician.dart';

class ApiService {
  // Dla emulatora Android: 10.0.2.2
  // Dla symulatora iOS: localhost
  // Dla prawdziwego urządzenia: IP komputera w sieci
  static String baseUrl = 'http://localhost:5050/api';

  static void setBaseUrl(String url) {
    baseUrl = url;
  }

  static Future<List<Technician>> getTechnicians() async {
    final res = await http.get(Uri.parse('$baseUrl/technicians'));
    if (res.statusCode != 200) throw Exception('Błąd pobierania techników');
    final list = jsonDecode(res.body) as List;
    return list.map((j) => Technician.fromJson(j)).toList();
  }

  static Future<List<Order>> getTechnicianOrders(int technicianId, String date) async {
    final res = await http.get(
      Uri.parse('$baseUrl/orders/technician/$technicianId?date=$date'),
    );
    if (res.statusCode != 200) throw Exception('Błąd pobierania zleceń');
    final list = jsonDecode(res.body) as List;
    return list.map((j) => Order.fromJson(j)).toList();
  }

  static Future<void> completeOrder(int orderId, {
    String? paymentOverride,
    String? technicianNotes,
  }) async {
    final res = await http.put(
      Uri.parse('$baseUrl/orders/$orderId/complete'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        if (paymentOverride != null) 'paymentOverride': paymentOverride,
        if (technicianNotes != null) 'technicianNotes': technicianNotes,
      }),
    );
    if (res.statusCode != 200) throw Exception('Błąd zamykania zlecenia');
  }

  static Future<void> reportLocation(int technicianId, double lat, double lng) async {
    await http.post(
      Uri.parse('$baseUrl/orders/technician/$technicianId/location'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'lat': lat, 'lng': lng}),
    );
  }
}

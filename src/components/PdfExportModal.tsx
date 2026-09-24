import React, { useState } from 'react';
import { X, FileDown, CheckCircle, Sparkles, Printer } from 'lucide-react';
import { Trip } from '../types.js';
import { jsPDF } from 'jspdf';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const generatePdf = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();

      // Header Brand
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SMART VOYAGER AI', 14, 15);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Autonomous Itinerary & Travel Briefing Document', 14, 23);

      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | v${trip.version}`, 145, 23);

      // Trip Overview
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(trip.title, 14, 45);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Route: ${trip.origin} -> ${trip.destination}`, 14, 52);
      doc.text(`Dates: ${trip.start_date} to ${trip.end_date} (${trip.days?.length || 0} Days)`, 14, 58);
      doc.text(`Travellers: ${trip.travellers_count} Pax | Budget Cap: INR ${trip.budget.toLocaleString('en-IN')}`, 14, 64);

      // Selected Transport & Hotel
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 70, 196, 70);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Primary Bookings:', 14, 78);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      if (trip.selected_transport) {
        const modeLabel = (trip.selected_transport.mode || trip.selected_transport.type || 'transit').toUpperCase();
        doc.text(
          `• Transit: ${trip.selected_transport.carrier} (${modeLabel}) - INR ${trip.selected_transport.price?.toLocaleString('en-IN')}`,
          14,
          85
        );
      }
      if (trip.selected_hotel) {
        doc.text(
          `• Accommodation: ${trip.selected_hotel.name} (${trip.selected_hotel.location}) - INR ${trip.selected_hotel.total_price.toLocaleString('en-IN')}`,
          14,
          91
        );
      }

      // Budget Breakdown
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Cost Allocation Summary:', 14, 102);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const b = trip.budget_summary.estimated_cost;
      doc.text(
        `Transport: INR ${b.transport.toLocaleString('en-IN')} | Hotel: INR ${b.accommodation.toLocaleString('en-IN')} | Food: INR ${b.food.toLocaleString('en-IN')}`,
        14,
        108
      );
      doc.text(
        `Activities: INR ${b.activities.toLocaleString('en-IN')} | Local Transit: INR ${b.local_transport.toLocaleString('en-IN')} | Total Est: INR ${b.total.toLocaleString('en-IN')} (${trip.budget_summary.usage_percentage}%)`,
        14,
        114
      );

      // Day-by-Day Timeline
      doc.line(14, 120, 196, 120);
      let yPos = 128;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Day-by-Day Itinerary Schedule:', 14, yPos);
      yPos += 8;

      trip.days.forEach((day) => {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(`DAY ${day.day_number}: ${day.title} (${day.date})`, 14, yPos);
        yPos += 5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        if (day.weather_summary) {
          doc.text(
            `Weather: ${day.weather_summary.temp_c}°C, ${day.weather_summary.condition}, Rain Risk: ${day.weather_summary.rain_prob_pct}%`,
            14,
            yPos
          );
          yPos += 5;
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);

        day.items.forEach((it) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          const costStr =
            it.category === 'flight' || it.category === 'transport'
              ? it.cost_estimate === 0
                ? 'Ticket Included'
                : `INR ${it.cost_estimate.toLocaleString('en-IN')}`
              : it.cost_estimate === 0
              ? 'Free Entry'
              : `INR ${it.cost_estimate.toLocaleString('en-IN')}`;
          const catLabel = (it.category || 'activity').toUpperCase();
          doc.text(`[${it.time}] ${it.title} (${catLabel}) - ${costStr}`, 18, yPos);
          yPos += 4;
          if (it.description) {
            const splitDesc = doc.splitTextToSize(`Location: ${it.location} | ${it.description}`, 175);
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(splitDesc, 20, yPos);
            yPos += splitDesc.length * 3.5 + 2;
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
          }
        });

        yPos += 4;
      });

      // Footer Notes & Data Sources
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.line(14, yPos, 196, yPos);
      yPos += 6;
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Smart Voyager AI verified live data feeds: Open-Meteo, Open Exchange Rates, Google Places Directory, Amadeus GDS.', 14, yPos);
      yPos += 4;
      doc.text('Always double-check airline boarding gates and regional monument entry passes prior to departure.', 14, yPos);

      // Save document
      doc.save(`Smart_Voyager_${trip.destination}_Itinerary_v${trip.version}.pdf`);
      setDownloaded(true);
    } catch (e) {
      console.error(e);
      alert('PDF generation error: ' + e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Export Offline PDF Itinerary</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{trip.title} &bull; v{trip.version}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-6">
          <p>
            Download an offline, travel-ready PDF packet featuring:
          </p>
          <ul className="space-y-1.5 list-disc pl-4 text-slate-700 dark:text-slate-300">
            <li>Complete day-by-day scheduled itinerary with timings</li>
            <li>Live weather forecasts & precipitation alerts</li>
            <li>Confirmed flight/train and hotel reservation details</li>
            <li>Itemized category expense allocations & budget limits</li>
            <li>Data source verification stamps & emergency notes</li>
          </ul>
        </div>

        {downloaded && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>PDF downloaded successfully! Ready for printing or offline viewing.</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={generatePdf}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60"
          >
            <FileDown className="w-4 h-4" />
            <span>{generating ? 'Generating Document...' : 'Download PDF Document'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

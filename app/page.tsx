'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BodySystemOption = {
  value: string;
  label: string;
};

type Condition = {
  id: string;
  name: string;
};

type HerbRow = {
  id: string;
  herbName: string;
  latinName: string;
  actions: string | null;
  indications: string | null;
  energeticProperties: string | null;
  safetyPrecautions: string | null;

  ratio: string | null;
  doseMinMl: number | null;
  doseMaxMl: number | null;
  doseUnit: string | null;

  therapeuticDosage: string | null;
};

function formatDose(row: HerbRow): string {
  const unit = row.doseUnit ?? 'mL';

  if (
    row.doseMinMl != null &&
    row.doseMaxMl != null &&
    row.doseMinMl !== row.doseMaxMl
  ) {
    return `(${row.ratio}) ${row.doseMinMl}–${row.doseMaxMl} ${unit}`;
  }

  if (
    row.doseMinMl != null &&
    (row.doseMaxMl == null || row.doseMinMl === row.doseMaxMl)
  ) {
    return `(${row.ratio}) ${row.doseMinMl} ${unit}`;
  }

  if (row.therapeuticDosage) {
    return row.therapeuticDosage;
  }

  return '';
}

export default function HomePage() {
  const [bodySystems, setBodySystems] = useState<BodySystemOption[]>([]);
  const [selectedBodySystem, setSelectedBodySystem] = useState<string>('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedConditionId, setSelectedConditionId] = useState<string>('');
  const [herbRows, setHerbRows] = useState<HerbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Herb selected for the side drawer
  const [selectedHerb, setSelectedHerb] = useState<HerbRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    // wait for animation to finish before unmounting
    setTimeout(() => {
      setSelectedHerb(null);
    }, 200);
  };

  // ⭐ Get currently selected condition object
  const selectedCondition = conditions.find(
    (c) => c.id === selectedConditionId
  );

  // Load body systems
  useEffect(() => {
    const fetchBodySystems = async () => {
      setError(null);

      const { data, error } = await supabase
        .from('conditions')
        .select('body_system')
        .not('body_system', 'is', null);

      if (error) {
        console.error(error);
        setError('Could not load body systems.');
        return;
      }

      const unique = Array.from(
        new Set((data ?? []).map((row: any) => row.body_system as string))
      ).sort();

      const options: BodySystemOption[] = unique.map((bs) => ({
        value: bs,
        label: bs,
      }));

      setBodySystems(options);
      setSelectedBodySystem('');
    };

    fetchBodySystems();
  }, []);

  // Load conditions for selected body system
  useEffect(() => {
    const fetchConditions = async () => {
      if (!selectedBodySystem) {
        setConditions([]);
        setSelectedConditionId('');
        setHerbRows([]);
        return;
      }

      setError(null);

      const { data, error } = await supabase
        .from('conditions')
        .select('id, name')
        .eq('body_system', selectedBodySystem)
        .order('name', { ascending: true });

      if (error) {
        console.error(error);
        setError('Could not load health concerns.');
        return;
      }

      setConditions(data as Condition[]);
      setSelectedConditionId('');
      setHerbRows([]);
    };

    fetchConditions();
  }, [selectedBodySystem]);

  // Load herbs for selected condition
  useEffect(() => {
    const fetchHerbs = async () => {
      if (!selectedConditionId) {
        setHerbRows([]);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('condition_herbs')
        .select(`
          id,
          indications,
          ratio,
          dose_min_ml,
          dose_max_ml,
          dose_unit,
          therapeutic_dosage,
          herbs:herb_id (
            herb_name,
            latin_name,
            actions,
            energetic_properties,
            safety_precautions
          )
        `)
        .eq('condition_id', selectedConditionId)
        .order('id', { ascending: true });

      setLoading(false);

      if (error) {
        console.error(error);
        setError('Could not load herbs for this concern.');
        return;
      }

      const rows: HerbRow[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          herbName: row.herbs?.herb_name ?? '',
          latinName: row.herbs?.latin_name ?? '',
          actions: row.herbs?.actions ?? null,
          indications: row.indications ?? null,
          energeticProperties: row.herbs?.energetic_properties ?? null,
          safetyPrecautions: row.herbs?.safety_precautions ?? null,

          ratio: row.ratio ?? null,
          doseMinMl:
            row.dose_min_ml !== null && row.dose_min_ml !== undefined
              ? Number(row.dose_min_ml)
              : null,
          doseMaxMl:
            row.dose_max_ml !== null && row.dose_max_ml !== undefined
              ? Number(row.dose_max_ml)
              : null,
          doseUnit: row.dose_unit ?? null,

          therapeuticDosage: row.therapeutic_dosage ?? null,
        })) ?? [];

      rows.sort((a, b) => a.herbName.localeCompare(b.herbName));
      setHerbRows(rows);
    };

    fetchHerbs();
  }, [selectedConditionId]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto py-10 px-4">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">
            Naturopath Cheat Sheet (Prototype)
          </h1>
          <p className="text-xs text-red-400 max-w-xl">
            Educational prototype only. This does not replace individual
            assessment, diagnosis or treatment. Use clinical judgement and local
            regulations.
          </p>
        </header>

        <section className="mb-8 space-y-4">
          <div>
            <label className="block text-sm mb-1">Body System</label>
            <select
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
              value={selectedBodySystem}
              onChange={(e) => {
                closeDrawer();
                setSelectedBodySystem(e.target.value);
              }}
            >
              <option value="">Select a body system...</option>
              {bodySystems.map((bs) => (
                <option key={bs.value} value={bs.value}>
                  {bs.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Health Concern</label>
            <select
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
              value={selectedConditionId}
              onChange={(e) => {
                closeDrawer();
                setSelectedConditionId(e.target.value);
              }}
              disabled={!selectedBodySystem || conditions.length === 0}
            >
              <option value="">
                {selectedBodySystem
                  ? 'Select a health concern...'
                  : 'Select a body system first...'}
              </option>
              {conditions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {loading && (
          <p className="text-sm text-slate-300 mb-4">Loading herbs...</p>
        )}

        {selectedConditionId && herbRows.length > 0 && (
          <section className="mt-6">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-semibold">
                {selectedCondition
                  ? `Herbs for ${selectedCondition.name}`
                  : 'Herbs for selected concern'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Click a herb row to view full details
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                {/* Scrollable area with sticky, opaque header */}
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="min-w-full text-xs md:text-sm border-collapse">
                    <thead className="bg-slate-900 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-3 border-b border-r border-slate-800/60 font-semibold text-slate-100">
                          Herb
                        </th>
                        <th className="text-left px-4 py-3 border-b border-r border-slate-800/60 font-semibold text-slate-100">
                          Latin Name
                        </th>
                        <th className="text-left px-4 py-3 border-b border-r border-slate-800/60 font-semibold text-slate-100">
                          Action
                        </th>
                        <th className="text-left px-4 py-3 border-b border-r border-slate-800/60 font-semibold text-slate-100">
                          Indications
                        </th>
                        <th className="text-left px-4 py-3 border-b border-r border-slate-800/60 font-semibold text-slate-100">
                          Energetic Properties
                        </th>
                        <th className="text-left px-4 py-3 border-b border-r border-slate-800/60 font-semibold text-slate-100">
                          Safety Precautions
                        </th>
                        <th className="text-left px-4 py-3 border-b border-slate-800/60 font-semibold text-slate-100 whitespace-nowrap">
                          Therapeutic Dosage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {herbRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => {
                            setSelectedHerb(row);
                            setIsDrawerOpen(true);
                          }}
                          className="cursor-pointer odd:bg-slate-950 even:bg-slate-900 hover:bg-slate-800/70 transition-colors"
                        >
                          <td className="align-top px-4 py-3 border-b border-r border-slate-800/40">
                            {row.herbName}
                          </td>

                          <td className="align-top px-4 py-3 border-b border-r border-slate-800/40 italic text-slate-300">
                            {row.latinName}
                          </td>

                          <td className="align-top px-4 py-3 border-b border-r border-slate-800/40">
                            <p className="cell-2-lines">{row.actions}</p>
                          </td>

                          <td className="align-top px-4 py-3 border-b border-r border-slate-800/40">
                            <p className="cell-2-lines">{row.indications}</p>
                          </td>

                          <td className="align-top px-4 py-3 border-b border-r border-slate-800/40">
                            <p className="cell-2-lines">
                              {row.energeticProperties}
                            </p>
                          </td>

                          <td className="align-top px-4 py-3 border-b border-r border-slate-800/40">
                            <p className="cell-2-lines">
                              {row.safetyPrecautions}
                            </p>
                          </td>

                          <td className="align-top px-4 py-3 border-b border-slate-800/40 whitespace-nowrap">
                            {formatDose(row)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400">
                Prototype data only. Always check current references and
                clinical guidelines.
              </div>
            </div>
          </section>
        )}

        {selectedConditionId &&
          herbRows.length === 0 &&
          !loading &&
          !error && (
            <p className="text-sm text-slate-300">
              No herbs have been added yet for this concern.
            </p>
          )}
      </div>

      {/* 🌿 Herb Details Side Drawer – outside the table */}
      {selectedHerb && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop with fade */}
          <button
            type="button"
            aria-label="Close herb details"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              isDrawerOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeDrawer}
          />

          {/* Drawer panel with slide animation */}
          <div
            className={`relative z-50 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${
              isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <p className="text-xs text-sky-300 tracking-wide">Herb</p>
                <p className="text-lg font-semibold">
                  {selectedHerb.herbName}
                </p>
                <p className="italic text-slate-300">
                  {selectedHerb.latinName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="ml-4 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              {selectedHerb.actions && (
                <div>
                  <h4 className="text-sky-300 text-xs mb-1 tracking-wide">
                    Actions
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-200">
                    {selectedHerb.actions}
                  </p>
                </div>
              )}

              {selectedHerb.indications && (
                <div>
                  <h4 className="text-sky-300 text-xs mb-1 tracking-wide">
                    Indications
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-200">
                    {selectedHerb.indications}
                  </p>
                </div>
              )}

              {selectedHerb.energeticProperties && (
                <div>
                  <h4 className="text-sky-300 text-xs mb-1 tracking-wide">
                    Energetic Properties
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-200">
                    {selectedHerb.energeticProperties}
                  </p>
                </div>
              )}

              {selectedHerb.safetyPrecautions && (
                <div>
                  <h4 className="text-sky-300 text-xs mb-1 tracking-wide">
                    Safety Precautions
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-200">
                    {selectedHerb.safetyPrecautions}
                  </p>
                </div>
              )}

              {formatDose(selectedHerb) && (
                <div>
                  <h4 className="text-sky-300 text-xs mb-1 tracking-wide">
                    Therapeutic Dosage
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-200">
                    {formatDose(selectedHerb)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

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

type WorkspaceHerb = {
  herb: HerbRow;
  ml: number;
  withinRange: boolean | null;
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

function isDoseWithinRange(row: HerbRow, ml: number): boolean | null {
  const min = row.doseMinMl;
  const max = row.doseMaxMl;

  if (min == null && max == null) return null;
  if (min != null && max != null) return ml >= min && ml <= max;
  if (min != null && max == null) return ml >= min;
  if (max != null && min == null) return ml <= max;

  return null;
}

export default function HomePage() {
  const [bodySystems, setBodySystems] = useState<BodySystemOption[]>([]);
  const [selectedBodySystem, setSelectedBodySystem] = useState<string>('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedConditionId, setSelectedConditionId] = useState<string>('');
  const [herbRows, setHerbRows] = useState<HerbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedHerb, setSelectedHerb] = useState<HerbRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [clientName, setClientName] = useState('');
  const [tonicPurpose, setTonicPurpose] = useState('');
  const [medications, setMedications] = useState('');
  const [existingConditionsText, setExistingConditionsText] = useState('');
  const [bottleSize, setBottleSize] =
    useState<'100' | '200' | '500' | ''>('');

  const [workspaceHerbs, setWorkspaceHerbs] = useState<WorkspaceHerb[]>([]);

  // mL modal state
  const [mlModalOpen, setMlModalOpen] = useState(false);
  const [mlModalHerb, setMlModalHerb] = useState<HerbRow | null>(null);
  const [mlModalIndex, setMlModalIndex] = useState<number | null>(null);
  const [mlModalValue, setMlModalValue] = useState<string>('');

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedHerb(null), 200);
  };

  const selectedCondition = conditions.find(
    (c) => c.id === selectedConditionId
  );

  // Bottle / volume calculations
  const bottleVolumeMl = bottleSize ? Number(bottleSize) : 0;
  const totalWorkspaceMl = workspaceHerbs.reduce((s, i) => s + i.ml, 0);

  // Raw % can exceed 100 for logic + display
  const bottleFillPercentRaw =
    bottleVolumeMl === 0 ? 0 : (totalWorkspaceMl / bottleVolumeMl) * 100;

  // Clamp to 0–100 for visual height
  const bottleFillPercent = Math.min(100, Math.max(0, bottleFillPercentRaw));

  // Overfilled if total volume > bottle volume
  const isOverfilled =
    bottleVolumeMl > 0 && totalWorkspaceMl > bottleVolumeMl;

  const isHerbInWorkspace = (herbId: string) =>
    workspaceHerbs.some((item) => item.herb.id === herbId);

  // LOAD BODY SYSTEMS
  useEffect(() => {
    const fetchBodySystems = async () => {
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
        new Set((data ?? []).map((r: any) => r.body_system))
      ).sort();

      setBodySystems(unique.map((v) => ({ value: v, label: v })));
    };

    fetchBodySystems();
  }, []);

  // LOAD CONDITIONS
  useEffect(() => {
    if (!selectedBodySystem) {
      setConditions([]);
      setSelectedConditionId('');
      setHerbRows([]);
      setWorkspaceHerbs([]);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('conditions')
        .select('id, name')
        .eq('body_system', selectedBodySystem)
        .order('name');

      if (error) {
        console.error(error);
        setError('Could not load health concerns.');
        return;
      }

      setConditions(data ?? []);
      setSelectedConditionId('');
      setHerbRows([]);
      setWorkspaceHerbs([]);
    };

    load();
  }, [selectedBodySystem]);

  // LOAD HERBS
  useEffect(() => {
    if (!selectedConditionId) {
      setHerbRows([]);
      setWorkspaceHerbs([]);
      return;
    }

    const load = async () => {
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
        .eq('condition_id', selectedConditionId);

      setLoading(false);

      if (error) {
        console.error(error);
        setError('Could not load herbs for this concern.');
        return;
      }

      const rows: HerbRow[] =
        data?.map((row: any) => ({
          id: row.id,
          herbName: row.herbs.herb_name,
          latinName: row.herbs.latin_name,
          actions: row.herbs.actions,
          indications: row.indications,
          energeticProperties: row.herbs.energetic_properties,
          safetyPrecautions: row.herbs.safety_precautions,
          ratio: row.ratio,
          doseMinMl:
            row.dose_min_ml !== null && row.dose_min_ml !== undefined
              ? Number(row.dose_min_ml)
              : null,
          doseMaxMl:
            row.dose_max_ml !== null && row.dose_max_ml !== undefined
              ? Number(row.dose_max_ml)
              : null,
          doseUnit: row.dose_unit,
          therapeuticDosage: row.therapeutic_dosage,
        })) ?? [];

      setHerbRows(rows.sort((a, b) => a.herbName.localeCompare(b.herbName)));
      setWorkspaceHerbs([]);
    };

    load();
  }, [selectedConditionId]);

  // OPEN mL MODAL FOR NEW HERB
  const handleAddHerbToWorkspace = (herb: HerbRow) => {
    if (isHerbInWorkspace(herb.id)) {
      return;
    }

    setMlModalHerb(herb);
    setMlModalIndex(null);
    setMlModalValue('');
    setMlModalOpen(true);
  };

  // REMOVE FROM WORKSPACE (by index)
  const handleRemoveWorkspaceHerb = (index: number) =>
    setWorkspaceHerbs((prev) => prev.filter((_, i) => i !== index));

  // REMOVE FROM WORKSPACE (from table button)
  const handleRemoveHerbFromTable = (herbId: string) => {
    setWorkspaceHerbs((prev) => prev.filter((item) => item.herb.id !== herbId));
  };

  // OPEN mL MODAL FOR EDIT
  const handleEditWorkspaceHerbMl = (index: number) => {
    const current = workspaceHerbs[index];
    if (!current) return;

    setMlModalHerb(current.herb);
    setMlModalIndex(index);
    setMlModalValue(String(current.ml));
    setMlModalOpen(true);
  };

  // CONFIRM mL MODAL
  const handleConfirmMlModal = () => {
    if (!mlModalHerb) return;

    const ml = Number(mlModalValue);
    if (Number.isNaN(ml) || ml <= 0) {
      window.alert('Please enter a valid mL amount.');
      return;
    }

    const withinRange = isDoseWithinRange(mlModalHerb, ml);

    if (mlModalIndex === null) {
      // add new herb
      setWorkspaceHerbs((prev) => [
        ...prev,
        { herb: mlModalHerb, ml, withinRange },
      ]);
    } else {
      // update existing herb
      setWorkspaceHerbs((prev) =>
        prev.map((item, i) =>
          i === mlModalIndex ? { ...item, ml, withinRange } : item
        )
      );
    }

    setMlModalOpen(false);
    setMlModalHerb(null);
    setMlModalIndex(null);
    setMlModalValue('');
  };

  const handleCloseMlModal = () => {
    setMlModalOpen(false);
    setMlModalHerb(null);
    setMlModalIndex(null);
    setMlModalValue('');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto py-10 px-4">
        {/* HEADER */}
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

        {/* CLIENT DETAILS + WORKSPACE */}
        <section className="mb-10 grid gap-6 md:grid-cols-[3fr_2fr]">
          {/* CLIENT DETAILS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
            <h2 className="text-lg font-semibold">Client Details</h2>

            <div>
              <label className="block text-xs mb-1 text-slate-300">
                Client Name
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Jamie Smith"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-slate-300">
                Tonic Purpose
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                value={tonicPurpose}
                onChange={(e) => setTonicPurpose(e.target.value)}
                placeholder="e.g. Sleep support, stress, digestion"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-slate-300">
                Medications
              </label>
              <textarea
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm min-h-[60px]"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-slate-300">
                Existing Conditions
              </label>
              <textarea
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm min-h-[60px]"
                value={existingConditionsText}
                onChange={(e) => setExistingConditionsText(e.target.value)}
              />
            </div>

            <div className="max-w-xs">
              <label className="block text-xs mb-1 text-slate-300">
                Bottle Size
              </label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                value={bottleSize}
                onChange={(e) =>
                  setBottleSize(
                    e.target.value as '100' | '200' | '500' | ''
                  )
                }
              >
                <option value="">Select bottle size...</option>
                <option value="100">100 mL</option>
                <option value="200">200 mL</option>
                <option value="500">500 mL</option>
              </select>
            </div>
          </div>

          {/* WORKSPACE */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
            <h2 className="text-lg font-semibold">Workspace</h2>

            <div className="flex items-center gap-4">
  <div className="flex flex-col items-center">
    <div className="flex flex-col items-center">
      {/* Cap – now dark, not white */}
      <div className="h-4 w-10 bg-slate-900 border border-slate-600 rounded-t-md rounded-b-sm" />

      {/* Neck */}
      <div className="h-4 w-8 bg-slate-900 border-x border-b border-slate-600" />

      {/* Bottle body (no amber overlay) */}
      <div className="relative h-32 w-16 bg-slate-900 border border-slate-600 rounded-t-xl rounded-b-3xl overflow-hidden">
        {/* Liquid fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out ${
            isOverfilled ? 'bg-red-500/80' : 'bg-emerald-500/80'
          }`}
          style={{ height: `${bottleFillPercent}%` }}
        />

        {/* Label band */}
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-7 bg-slate-950/85 border border-slate-600 rounded-md flex items-center justify-center px-1">
          <span className="text-[9px] text-slate-50 truncate text-center">
            {clientName || tonicPurpose || 'Herbal Tonic'}
          </span>
        </div>
      </div>
    </div>

    <p className="mt-2 text-xs text-slate-300">
      {bottleVolumeMl ? `${bottleVolumeMl} mL bottle` : 'No bottle size'}
    </p>
  </div>

  {/* Right-hand stats stay exactly the same */}
  <div className="text-xs space-y-1">
    <p className="text-slate-200">
      Total volume:{' '}
      <span className="font-semibold">
        {totalWorkspaceMl.toFixed(1)} mL
      </span>
    </p>
    <p className="text-slate-200">
      Fill:{' '}
      <span
        className={`font-semibold ${
          isOverfilled ? 'text-red-400' : 'text-emerald-400'
        }`}
      >
        {bottleVolumeMl ? `${bottleFillPercentRaw.toFixed(1)}%` : '—'}
      </span>
    </p>

    {isOverfilled && (
      <p className="text-[11px] text-red-400">
        Overfilled (&gt;{bottleVolumeMl} mL). Adjust volumes.
      </p>
    )}

    <p className="text-[11px] text-slate-400">
      Dose colour:{' '}
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        in range
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        out of range
      </span>
    </p>
  </div>
</div>


            {/* Workspace Herbs */}
            <div className="mt-2 border-t border-slate-800 pt-3">
              <h3 className="text-xs font-semibold text-slate-200 mb-2">
                Herbs in Tonic
              </h3>

              {workspaceHerbs.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  No herbs yet. Use <b>+ Add</b> in the table below.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-scroll pr-3">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-slate-950">
                      <tr>
                        <th className="text-left py-1 pr-2 border-b border-slate-800">
                          Herb
                        </th>
                        <th className="text-left py-1 px-2 border-b border-slate-800">
                          mL
                        </th>
                        <th className="text-left py-1 px-2 border-b border-slate-800">
                          Therapeutic Dosage (weekly)
                        </th>
                        <th className="text-left py-1 pl-2 border-b border-slate-800">
                          Remove
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceHerbs.map((item, index) => (
                        <tr
                          key={`${item.herb.id}-${index}`}
                          className={
                            item.withinRange === null
                              ? 'bg-slate-900/40'
                              : item.withinRange
                              ? 'bg-emerald-900/20'
                              : 'bg-red-900/20'
                          }
                        >
                          <td className="py-1 pr-2 align-top">
                            <div className="font-medium">
                              {item.herb.herbName}
                            </div>
                            <div className="italic text-[10px] text-slate-300">
                              {item.herb.latinName}
                            </div>
                          </td>
                          <td className="py-1 px-2 align-top">
                            <button
                              type="button"
                              onClick={() => handleEditWorkspaceHerbMl(index)}
                              className="underline decoration-dotted underline-offset-2 hover:text-emerald-300"
                            >
                              {item.ml.toFixed(1)} mL
                            </button>
                          </td>
                          <td className="py-1 px-2 align-top">
                            {item.herb.doseMinMl != null ||
                            item.herb.doseMaxMl != null ? (
                              <span>
                                {item.herb.doseMinMl != null &&
                                  `${item.herb.doseMinMl}`}
                                {item.herb.doseMinMl != null &&
                                  item.herb.doseMaxMl != null &&
                                  '–'}
                                {item.herb.doseMaxMl != null &&
                                  `${item.herb.doseMaxMl}`}{' '}
                                {item.herb.doseUnit ?? 'mL'}
                              </span>
                            ) : (
                              <span className="text-slate-400">No range</span>
                            )}
                          </td>
                          <td className="py-1 pl-2 align-top">
                            <button
                              type="button"
                              onClick={() => handleRemoveWorkspaceHerb(index)}
                              className="text-[10px] px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BODY SYSTEM + CONDITION (side by side) */}
        <section className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Body System */}
            <div>
              <label className="block text-sm mb-1">Body System</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                value={selectedBodySystem}
                onChange={(e) => setSelectedBodySystem(e.target.value)}
              >
                <option value="">Select...</option>
                {bodySystems.map((bs) => (
                  <option key={bs.value} value={bs.value}>
                    {bs.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Health Concern */}
            <div>
              <label className="block text-sm mb-1">Health Concern</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                value={selectedConditionId}
                onChange={(e) => setSelectedConditionId(e.target.value)}
                disabled={!selectedBodySystem}
              >
                <option value="">
                  {selectedBodySystem ? 'Select...' : 'Select body system first...'}
                </option>
                {conditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* HERB TABLE */}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {loading && (
          <p className="text-sm text-slate-300 mb-4">Loading herbs...</p>
        )}

        {selectedConditionId && herbRows.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 mt-4 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <div className="max-h-[480px] overflow-y-scroll pr-3">
                <table className="min-w-full text-xs md:text-sm border-collapse">
                  <thead className="bg-slate-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 border-b border-slate-800/60 w-28 text-left text-slate-100">
                        Workspace
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Herb
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Latin Name
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Action
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Indications
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Energetic Properties
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Safety Precautions
                      </th>
                      <th className="px-4 py-3 border-b border-slate-800/60 text-left text-slate-100">
                        Therapeutic Dosage
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {herbRows.map((row) => {
                      const inWorkspace = isHerbInWorkspace(row.id);
                      return (
                        <tr
                          key={row.id}
                          className="odd:bg-slate-950 even:bg-slate-900 hover:bg-slate-800/70 transition-colors"
                        >
                          {/* Workspace button */}
                          <td className="px-3 py-3 border-b border-slate-800/40">
                            {inWorkspace ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveHerbFromTable(row.id)}
                                className="text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 inline-flex items-center gap-1"
                              >
                                Remove
                                <span
                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-slate-500 text-[10px]"
                                  title="Herb already added to tonic"
                                >
                                  i
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddHerbToWorkspace(row)}
                                className="text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800"
                              >
                                + Add
                              </button>
                            )}
                          </td>

                          {/* Herb details cells (open drawer on click) */}
                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.herbName}
                          </td>

                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 italic text-slate-300 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.latinName}
                          </td>

                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.actions}
                          </td>

                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.indications}
                          </td>

                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.energeticProperties}
                          </td>

                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.safetyPrecautions}
                          </td>

                          <td
                            className="align-top px-4 py-3 border-b border-slate-800/40 whitespace-nowrap cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {formatDose(row)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400">
              Prototype data only. Always check current references and clinical
              guidelines.
            </div>
          </div>
        )}

        {selectedConditionId &&
          herbRows.length === 0 &&
          !loading &&
          !error && (
            <p className="text-sm text-slate-300 mt-4">
              No herbs added yet for this concern.
            </p>
          )}
      </div>

      {/* HERB DETAILS SIDE DRAWER */}
      {selectedHerb && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close herb details"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              isDrawerOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <div
            className={`relative z-50 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${
              isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
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

      {/* mL ENTRY / EDIT MODAL */}
      {mlModalOpen && mlModalHerb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 rounded-xl border border-slate-700 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">
              {mlModalIndex === null ? 'Add Herb to Tonic' : 'Edit Herb Volume'}
            </h3>

            <p className="text-sm mb-2 text-slate-300">
              Enter mL for{' '}
              <span className="font-semibold">{mlModalHerb.herbName}</span>:
            </p>

            <input
              type="number"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 mb-4 text-slate-100"
              placeholder="e.g. 5"
              value={mlModalValue}
              onChange={(e) => setMlModalValue(e.target.value)}
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseMlModal}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-md"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmMlModal}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-md font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

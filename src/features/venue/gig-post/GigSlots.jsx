import { useEffect, useRef, useState } from 'react'

export const GigSlots = ({
    formData,                // needs formData.duration (in minutes)
    multipleSlots,
    setMultipleSlots,
    numberOfSlots,
    setNumberOfSlots,
    slotSplits,
    setSlotSplits,
  }) => {
    const [equalSplit, setEqualSplit] = useState(true);
  
    const totalDuration = Number(formData?.duration || 0); // minutes
  
    // helpers
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const toInt = (v) => (v === '' ? '' : Number.isNaN(parseInt(v, 10)) ? '' : parseInt(v, 10));
  
    const makeEqualSplits = (count, total) => {
      if (!count || !total) return Array.from({ length: count || 0 }, () => 0);
      const base = Math.floor(total / count);
      const remainder = total - base * count;
      // Distribute remainders to the first few slots so the sum equals total
      return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
    };
  
    // when numberOfSlots or equalSplit changes, refresh slotSplits if equalSplit is on
    useEffect(() => {
      if (!multipleSlots) return;
      const n = clamp(Number(numberOfSlots || 0), 1, 20); // allow up to 20
      if (!n) return;
  
      if (equalSplit) {
        setSlotSplits(makeEqualSplits(n, totalDuration));
      } else {
        // ensure we have n entries; keep existing values where possible
        setSlotSplits((prev = []) => {
          const next = prev.slice(0, n);
          while (next.length < n) next.push(0);
          return next;
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [multipleSlots, numberOfSlots, equalSplit, totalDuration]);
  
    const handleNumberChange = (e) => {
      const val = toInt(e.target.value);
      if (val === '') {
        setNumberOfSlots('');
        setSlotSplits([]);
        return;
      }
      const n = clamp(val, 1, 20);
      setNumberOfSlots(n);
      if (equalSplit) {
        setSlotSplits(makeEqualSplits(n, totalDuration));
      } else {
        setSlotSplits((prev = []) => {
          const next = prev.slice(0, n);
          while (next.length < n) next.push(0);
          return next;
        });
      }
    };
  
    const handleCustomDurationChange = (index, value) => {
      const v = toInt(value);
      setSlotSplits((prev = []) => {
        const next = [...prev];
        next[index] = v === '' ? 0 : clamp(v, 0, 24 * 60); // cap at a day, arbitrary
        return next;
      });
    };
  
    return (
      <>
        <div className="head">
          <h1 className="title">Multiple Performers?</h1>
          <p className="text" style={{ marginTop: '1rem', fontSize: '1.1rem', width: '75%' }}>
            Do you want more than one musician to perform in this session?
          </p>
        </div>
  
        <div className="body open-mic">
          {/* Yes / No */}
          <div className="input-group">
            <div className="selections">
              <button
                type="button"
                className={`card small ${multipleSlots ? 'selected' : ''}`}
                onClick={() => setMultipleSlots(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`card small ${!multipleSlots ? 'selected' : ''}`}
                onClick={() => {
                  setMultipleSlots(false);
                  setNumberOfSlots(null);
                  setSlotSplits([]);
                }}
              >
                No
              </button>
            </div>
          </div>
  
          {multipleSlots && (
            <>
                <h4>Each gig slot will be posted as a seperate gig for musicians to apply to. This will help you easily manage the gig. The gig budget will be evenly split between the slots.</h4>

              {/* number of musicians (slots) */}
              <div className="input-group">
                <label htmlFor="slotsCount">How many musicians?</label>
                <input
                  id="slotsCount"
                  type="number"
                  min={1}
                  max={20}
                  value={numberOfSlots ?? ''}
                  onChange={handleNumberChange}
                  placeholder="e.g. 3"
                />
                <p className="subtext">Total gig duration: {totalDuration || 0} min</p>
              </div>
  
              {/* equal split preview */}
              {Number(numberOfSlots) > 0 && equalSplit && (
                <div className="input-group">
                  <label>Each slot duration</label>
                  <div className="preview-pills">
                    {(slotSplits || []).map((d, i) => (
                      <span key={i} className="pill">
                        Musician {i + 1}: {d} min
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  };
import { useEffect, useRef, useState } from 'react';
import { chooseDeskValue } from './privateDesk';
import { readOwnedDesk, writeOwnedDesk } from '@services/client-side/privateDeskStore';

export function useOwnedDesk({ scope, id, kind, empty, readLocal, writeLocal }) {
  const emptyRef = useRef(empty);
  const readRef = useRef(readLocal);
  const writeRef = useRef(writeLocal);
  const generation = useRef(0);
  emptyRef.current = empty;
  readRef.current = readLocal;
  writeRef.current = writeLocal;
  const [value, setValue] = useState(empty);

  useEffect(() => {
    let cancel = false;
    const local = readRef.current?.() ?? emptyRef.current;
    const started = generation.current;
    setValue(local);
    if (!id) return undefined;
    readOwnedDesk(scope, id, kind).then((remote) => {
      if (cancel || generation.current !== started) return;
      const choice = chooseDeskValue(remote, local, emptyRef.current);
      setValue(choice.value);
      if (choice.write) {
        writeOwnedDesk(scope, id, kind, choice.value).catch((error) => console.error(error));
      }
    }).catch((error) => {
      console.error(error);
      if (!cancel) setValue(local);
    });
    return () => { cancel = true; };
  }, [scope, id, kind]);

  const save = (next) => {
    generation.current += 1;
    setValue(next);
    writeRef.current?.(next);
    if (!id) return;
    writeOwnedDesk(scope, id, kind, next).catch((error) => console.error(error));
  };

  return [value, save];
}

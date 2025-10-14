import { router } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';
import AcceptedRequestCard from '../components/AcceptedRequestCard';
import { completeAssist } from '../features/assistance/api';
import type { AssistanceRequest } from '../features/assistance/types';

export type AcceptedJob = {
  id: string;                 // <-- keep the request id so we can complete it
  clientName: string;
  placeName: string;
  address: string;
  vehicleType?: string;
  plateNumber?: string;
  phone?: string;
  otherInfo?: string;
  onRepaired?: () => void;
  onCancel?: () => void;
  bottomOffset?: number;
};

type State = { visible: boolean; job: AcceptedJob | null };

export default function useAcceptedJobUI(defaultBottomOffset = 12) {
  const [state, setState] = React.useState<State>({ visible: false, job: null });

  const open = React.useCallback((job: AcceptedJob) => {
    setState({ visible: true, job });
  }, []);

  const openFromRequest = React.useCallback(
    (
      req: AssistanceRequest,
      extras?: Pick<AcceptedJob, 'onRepaired' | 'onCancel' | 'bottomOffset'>
    ) => {
      if (!req) return;
      open({
        id: req.id,
        clientName: req.clientName,
        placeName: req.placeName,
        address: req.address,
        vehicleType: req.vehicleType ?? undefined,
        plateNumber: req.plateNumber ?? undefined,
        phone: req.phone ?? undefined,
        otherInfo: req.otherInfo ?? undefined,
        onRepaired: extras?.onRepaired,
        onCancel: extras?.onCancel,
        bottomOffset: extras?.bottomOffset,
      });
    },
    [open]
  );

  const close = React.useCallback(() => setState({ visible: false, job: null }), []);

  async function handleRepaired() {
    try {
      if (!state.job) return;
      const j = state.job;

      // Close the card immediately to prevent first screen flash
      close();

      // 1) tell the server this request is complete; get details back
      const completed = await completeAssist(j.id);

      // 2) go to the detail screen using expo-router
      router.push({
        pathname: '/activity-detail',
        params: {
          id: completed.id || j.id, // Only pass id - let ActivityDetailScreen fetch fresh data
        },
      });

      j.onRepaired?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to complete request');
    }
  }

  const element =
    state.visible && state.job ? (
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 9999 }}
      >
        <AcceptedRequestCard
          clientName={state.job.clientName}
          placeName={state.job.placeName}
          address={state.job.address}
          vehicleType={state.job.vehicleType}
          plateNumber={state.job.plateNumber}
          phone={state.job.phone}
          otherInfo={state.job.otherInfo}
          onMessage={() => {}}
          onRepaired={handleRepaired}                     // <-- calls server + navigates
          onCancelPress={() => {
            state.job?.onCancel?.();
            close();
          }}
          absolute
          bottomOffset={state.job.bottomOffset ?? defaultBottomOffset}
        />
      </View>
    ) : null;

  return { element, open, openFromRequest, close, visible: state.visible };
}

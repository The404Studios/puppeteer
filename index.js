// Core
import Vector3 from './core/Vector3.js';
import Quaternion from './core/Quaternion.js';
import Transform from './core/Transform.js';
import Matrix4 from './core/Matrix4.js';
import Snapshot from './core/Snapshot.js';

// Interpolation
import * as Interpolator from './interp/Interpolator.js';
import SnapshotBuffer from './interp/SnapshotBuffer.js';
import AdvancedInterpolation from './interp/AdvancedInterpolation.js';

// Networking
import * as RoomClient from './net/RoomClient.js';
import * as RoomHost from './net/RoomHost.js';
import { Packet, PacketType, PacketUtils } from './net/Packet.js';
import MessageRouter from './net/MessageRouter.js';
import TimeSync from './net/TimeSync.js';
import { ConnectionManager, ConnectionState } from './net/ConnectionManager.js';
import ReliableChannel from './net/ReliableChannel.js';
import LagCompensator from './net/LagCompensator.js';
import AuthManager from './net/AuthManager.js';
import NetworkManager from './net/NetworkManager.js';

// Movement
import MovementController from './movement/MovementController.js';
import Physics from './movement/Physics.js';
import CollisionSystem from './movement/CollisionSystem.js';
import InputBuffer from './movement/InputBuffer.js';
import Predictor from './movement/Predictor.js';
import Reconciler from './movement/Reconciler.js';

// Utilities
import Clock from './utils/Clock.js';
import UUID from './utils/UUID.js';
import EventEmitter from './utils/EventEmitter.js';
import { Logger, LogLevel, defaultLogger } from './utils/Logger.js';
import Compression from './utils/Compression.js';
import DeltaCompression from './utils/DeltaCompression.js';
import PerfMeter from './utils/PerfMeter.js';
import DebugOverlay from './utils/DebugOverlay.js';
import NetStats from './utils/NetStats.js';
import RingBuffer from './utils/RingBuffer.js';
import FrameTimer from './utils/FrameTimer.js';
import StateCache from './utils/StateCache.js';

// Main export
export default {
  // Core
  Core: {
    Vector3,
    Quaternion,
    Transform,
    Matrix4,
    Snapshot,
  },

  // Interpolation
  Interp: {
    Interpolator,
    SnapshotBuffer,
    AdvancedInterpolation,
  },

  // Networking
  Net: {
    RoomClient,
    RoomHost,
    Packet,
    PacketType,
    PacketUtils,
    MessageRouter,
    TimeSync,
    ConnectionManager,
    ConnectionState,
    ReliableChannel,
    LagCompensator,
    AuthManager,
    NetworkManager,
  },

  // Movement
  Movement: {
    MovementController,
    Physics,
    CollisionSystem,
    InputBuffer,
    Predictor,
    Reconciler,
  },

  // Utilities
  Utils: {
    Clock,
    UUID,
    EventEmitter,
    Logger,
    LogLevel,
    defaultLogger,
    Compression,
    DeltaCompression,
    PerfMeter,
    DebugOverlay,
    NetStats,
    RingBuffer,
    FrameTimer,
    StateCache,
  },

  // Convenience exports
  Vector3,
  Quaternion,
  Transform,
  MovementController,
  NetworkManager,
  Compression,
};

// Named exports
export {
  // Core
  Vector3,
  Quaternion,
  Transform,
  Matrix4,
  Snapshot,

  // Interpolation
  Interpolator,
  SnapshotBuffer,
  AdvancedInterpolation,

  // Networking
  RoomClient,
  RoomHost,
  Packet,
  PacketType,
  PacketUtils,
  MessageRouter,
  TimeSync,
  ConnectionManager,
  ConnectionState,
  ReliableChannel,
  LagCompensator,
  AuthManager,
  NetworkManager,

  // Movement
  MovementController,
  Physics,
  CollisionSystem,
  InputBuffer,
  Predictor,
  Reconciler,

  // Utilities
  Clock,
  UUID,
  EventEmitter,
  Logger,
  LogLevel,
  defaultLogger,
  Compression,
  DeltaCompression,
  PerfMeter,
  DebugOverlay,
  NetStats,
  RingBuffer,
  FrameTimer,
  StateCache,
};

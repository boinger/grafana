import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { type GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import {
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
  sceneGraph,
} from '@grafana/scenes';
import { Box, Button, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { openAddFilterPane } from '../../edit-pane/add-new/AddFilters';
import { partitionVariablesByDisplay } from '../../edit-pane/dashboard/DashboardVariablesList';
import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

export interface DashboardFiltersSetState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

function useEditPaneOptions(
  this: DashboardFiltersSet,
  dashboardRef: SceneObjectRef<DashboardScene>
): OptionsPaneCategoryDescriptor[] {
  const filterListId = useId();
  const dashboard = dashboardRef.resolve();

  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'filters' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: filterListId,
        skipField: true,
        render: () => <FilterList dashboard={dashboard} />,
      })
    );
  }, [filterListId, dashboard]);

  return [options];
}

export class DashboardFiltersSet extends SceneObjectBase<DashboardFiltersSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(state: DashboardFiltersSetState) {
    super({ ...state, key: 'dashboard-filters-set' });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const filters = this.getAdhocVariables();
    return {
      typeName: t('dashboard.edit-pane.elements.filters-set', 'Filters'),
      icon: 'filter',
      instanceName: t('dashboard.edit-pane.elements.filters-set', 'Filters'),
      isHidden: filters.length === 0,
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay(this.getAdhocVariables());
    return [...visible, ...controlsMenu, ...hidden];
  }

  private getAdhocVariables(): SceneVariable[] {
    const dashboard = this.state.dashboardRef.resolve();
    const variableSet = sceneGraph.getVariables(dashboard);
    if (!(variableSet instanceof SceneVariableSet)) {
      return [];
    }
    return variableSet.state.variables.filter((v) => v.state.type === 'adhoc');
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.state.dashboardRef);
}

function FilterList({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const variableSet = sceneGraph.getVariables(dashboard);

  const filters = useMemo(() => {
    if (!(variableSet instanceof SceneVariableSet)) {
      return [];
    }
    return variableSet.state.variables.filter((v) => v.state.type === 'adhoc');
  }, [variableSet]);

  const onEditFilter = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable);
  }, []);

  const onAddFilter = useCallback(() => {
    openAddFilterPane(dashboard);
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboard]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <Stack direction="column" gap={1}>
      {filters.map((variable) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
        <div
          className={styles.filterItem}
          key={variable.state.key ?? variable.state.name}
          onClick={() => onEditFilter(variable)}
        >
          <div className={styles.filterContent}>
            <div onPointerDown={onPointerDown}>
              <Tooltip content={t('dashboard.edit-pane.filters.reorder', 'Drag to reorder')} placement="top">
                <Icon name="draggabledots" size="md" className={styles.dragHandle} />
              </Tooltip>
            </div>
            <Text>{variable.state.name}</Text>
            {variable.state.hide === VariableHide.hideVariable && (
              <Icon name="eye-slash" size="sm" className={styles.hiddenIcon} />
            )}
            {variable.state.hide === VariableHide.inControlsMenu && (
              <Icon name="sliders-v-alt" size="sm" className={styles.hiddenIcon} />
            )}
          </div>
          <Stack direction="row" gap={1} alignItems="center">
            <Button variant="primary" size="sm" fill="outline">
              <Trans i18nKey="dashboard.edit-pane.filters.select-filter">Select</Trans>
            </Button>
          </Stack>
        </div>
      ))}
      <Box paddingBottom={1} paddingTop={1} display={'flex'}>
        <Button
          fullWidth
          icon="plus"
          size="sm"
          variant="secondary"
          onClick={onAddFilter}
          data-testid={selectors.components.PanelEditor.ElementEditPane.addFilterButton}
        >
          <Trans i18nKey="dashboard.edit-pane.filters.add-filter">Add filter</Trans>
        </Button>
      </Box>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    filterItem: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
    filterContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    dragHandle: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:active': {
        cursor: 'grabbing',
      },
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
  };
}

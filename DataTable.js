/* Define iAM Nested Tab
 * 
 * @Description It's like a 2nd level tree and follow the UI components style
 */

var iAM = iAM || {};

// Each tab contains a table, when tab is selected, the table will be filled with data from server.
iAM.DataTable = function(cfg) {
	this.ajaxConfig = {
			type : 'GET',
			contentType : 'application/json',
			dataType : 'json',
			data : null,
			context : this,
			success : this.processResp,
			error: this.error
		};
	
	// if table's data has been got, it's stored here.
	this.lastUdpateTime = 0;
	this.initialized = false;
	this.refreshDt;
	
	this.init(cfg);
};

iAM.DataTable.prototype = {
		/**
		 * cfg = {
		 * 	table_id: "id",
		 *  fnDataLoadedCallback: function(){},
		 * }
		 */
	init : function(cfg) {
		this.config =  $.extend({}, this.config, cfg);

		this.table = $('#' + cfg.table_id);
		this.tableConfig = $.extend({}, cfg.tableConfig);
		this.ajaxConfig = $.extend({}, this.ajaxConfig, {url: this.tableConfig.sAjaxSource, type: this.tableConfig.sServerMethod});
		
		if (!this.tableConfig.bServerSide) {
			delete this.tableConfig.sAjaxSource;
		}
	},

	/**
	 * Clear table
	 */
	clear : function() {
		if ($.fn.DataTable.fnIsDataTable(this.table.get(0)))
			this.table.dataTable().fnClearTable(false);
	},
	
	hide: function() {
		if ($.fn.DataTable.fnIsDataTable(this.table.get(0))) {
			$(this.table.dataTable().fnSettings().nTableWrapper).hide();
		} else {
			this.table.hide();
		}
	},
	
	show: function() {
		if ($.fn.DataTable.fnIsDataTable(this.table.get(0))) {
			$(this.table.dataTable().fnSettings().nTableWrapper).show();
		} else {
			this.table.show();
		}
	},

	/**
	 * If it's the first time to open this tab, send request and get the data from server. Otherwise,
	 * just refresh the table from local cache.
	 * 
	 * @param param
	 */
	update : function(param, toHideLoading) {
		if (this.tableConfig.bServerSide) {
			if (!this.initialized) {
				this.table.dataTable(this.tableConfig);
				this.initialized = true;
			} else {
				this.table.fnDraw();
			}
		} else {
			this.ajaxConfig.data = param;
			$.ajax(this.ajaxConfig);
			
			if (!toHideLoading) {
				$(document.body).isLoading({text:"Loading", position: "overlay"});
			}			
		}
	},

	error : function() {
		$(document.body).isLoading("hide");
		alert('iAM is non-available, please login again. If system cannot work still please try it later');
	},

	/**
	 * if data come from server, this method will be used to refresh the table.
	 * @param data
	 */
	processResp : function(data) {
		if (data && (data.success == "true" || data.status == "ok")) {
			if (this.tableConfig.fnDataLoadedCallback) {
				this.tableConfig.fnDataLoadedCallback.call(this, data);
			}
			
			this.feedTable(data);
			
			this.refreshDt = data.refreshDt;
		} else {
			alert("iAM is non-available, please login again. If system cannot work still please try it later");
		}
		
		$(document.body).isLoading("hide");
	},

	/**
	 * Resize data table column.
	 */
	resizeTable : function() {
		if (this.table && this.initialized) {
			this.table.dataTable().fnAdjustColumnSizing();
			var oFixedColumns = this.table.dataTable().fnSettings().oFixedColumns;
			if (oFixedColumns) {
//				oFixedColumns.fnRedrawLayout();
				oFixedColumns._fnGridLayout();
			}
		}
	},
	
	_preprocessData: function(data) {
		if (!data) return;
		
		try {
			if (typeof data.aaData === "string") {
				data.aaData = JSON.parse(data.aaData);
			}
		} catch (e) {
			console.log("Data is not a valid JSON string!");
		}
	},
	
	/**
	 * Use the data to update table, this data object must have "aaData" property and "aoColumns"
	 * property.
	 * 
	 * @param data
	 */
	feedTable: function(data){
		if (!data) return;
		
		this._preprocessData(data);
		
		this.tableConfig.aaData = data.aaData;
		if (data.serverTime) {
			this.tableConfig.serverTime = new Date(data.serverTime.substr(0, 10));
		}
		
		try {
			if (this.tableConfig.fnPreDataApplied) {
				if (this.initialized) {
					this.tableConfig.fnPreDataApplied(this.dataTable.fnSettings(), data, {serverTime: this.tableConfig.serverTime});
				} else {
					this.tableConfig.fnPreDataApplied(this.tableConfig, data, {serverTime: this.tableConfig.serverTime});
				}
			}
			
			if ($.fn.DataTable.fnIsDataTable(this.table.get(0))) {
				var dataTable = this.table.dataTable();
				dataTable.fnClearTable();
				dataTable.fnClearSearchs();
				dataTable.fnAddData(data.aaData);
			} else {
				this.dataTable = this.table.dataTable(this.tableConfig);
				this.initialized = true;
			}
			
			if (this.dataTable.fnSettings().oInit.fnNewDataApplied) {
				this.dataTable.fnSettings().oInit.fnNewDataApplied.call(this.dataTable, data);
			}
			
			this.resizeTable();
		} catch(e) {
			console.error("Failed to feed table: %s", e.message);
		}
		
	},
	
};

// manage all TabData components
iAM.DataTableManager = (function(){
	var tables = {};
	
	return {
		init : function(map) {
			for (var tableID in map) {
				$.extend(map[tableID], {"table_id": tableID});
				tables[tableID] = new iAM.DataTable(map[tableID]);
			}
		},

		/**
		 * Get a DataTab by DOM tab element id.
		 * 
		 * @param id
		 * @returns
		 */
		getDataTable : function(id) {
			return tables[id];
		},
		
		/**
		 * 
		 * @param id
		 * @param params
		 */
		refreshDataTable : function(id, params, filter_column, filter_value) {
			var table = this.getDataTable(id);
			if (!table) return; 
			
			table.update(params);
			
			this.lastTable = table;
			
			if (filter_column && filter_value) {
				table.fnDataLoadedCallback = function(){
					this.table.dataTable().fnFilter(filter_value, filter_column);
				};
			}
		},
		
		/**
		 * Resize specified data table.
		 * @param id
		 */
		resizeDataTable : function(id) {
			var table = this.getDataTable(id);
			if (!table) return; 
			
			table.resizeTable();
		},
		
		resizeDataTables : function() {
			for (var id in tables) {
				var table = tables[id];
				if (table) {
					table.resizeTable();
				}
			}
		}
	};
})();
